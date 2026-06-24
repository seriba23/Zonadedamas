// Client Component (corre en el navegador): usa hooks y maneja eventos.
'use client';

// useState: hook para guardar "estado" (datos que, al cambiar, repintan el
// componente). Cada llamada crea una variable + su función para actualizarla.
import { useState } from 'react';
// react-query: librería que gestiona las llamadas al servidor por nosotros
// (cache, recarga, estados de carga/error).
//   - useQuery: para LEER datos (GET).
//   - useMutation: para ESCRIBIR/cambiar datos (POST, PUT, DELETE).
import { useQuery, useMutation } from '@tanstack/react-query';
// Helper que formatea un número como moneda (ej. 1500 → "$1,500.00").
import { formatCurrency } from '@/lib/utils';
// Popup centrado con palomita de éxito (estilo estándar del proyecto).
import { SuccessPopup } from '@/components/ui/success-popup';

// URL base de la API y colores de marca reutilizados como constantes.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TEAL = '#008080';       // teal principal
const TEAL_DARK = '#006666';  // teal oscuro (hover)
const TEAL_LIGHT = '#e0f2f1'; // teal claro (fondos suaves)

// Forma de un producto de la tienda tal como llega del servidor.
interface ShopProduct {
  id: string;
  name: string;
  description?: string;
  category?: string;
  price: number;
  stock: number;          // unidades disponibles
  imageUrl?: string;      // imagen principal
  shippingCost?: number;  // costo de envío (0/ausente = gratis)
  // Galería de imágenes adicionales. sortOrder define el orden de aparición.
  images: { id: string; imageUrl: string; sortOrder: number }[];
}

// Datos bancarios para transferencia SPEI (México).
interface SpeiInfo {
  bankName?: string;
  holderName?: string;  // titular de la cuenta
  clabe?: string;       // número CLABE interbancaria
}

// Configuración de la tienda del negocio.
interface ShopSettings {
  shopEnabled: boolean;          // ¿la tienda está activa?
  paymentMethods: string[];      // métodos de pago aceptados (códigos)
  fulfillmentOptions: string[];  // formas de entrega (PICKUP, SHIPPING)
  speiInfo?: SpeiInfo | null;    // datos bancarios (si acepta SPEI)
}

// Diccionarios que traducen códigos a etiquetas en español para mostrar.
const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  SPEI: 'SPEI / Transferencia',
  CARD: 'Tarjeta (en terminal)',
};

const FULFILLMENT_LABELS: Record<string, string> = {
  PICKUP: 'Recoger en tienda',
  SHIPPING: 'Envio a domicilio',
};

// Componente "ShopSection": sección de tienda dentro del perfil público de un
// negocio en el marketplace. Lista productos, permite ver su detalle y
// "apartarlos" (reservarlos) llenando un formulario de contacto.
// Recibe una sola prop: tenantSlug (el identificador del negocio en la URL).
export function ShopSection({ tenantSlug }: { tenantSlug: string }) {
  // ── ESTADOS (useState) ──
  // useState devuelve un par [valor, función_para_cambiarlo]. Al llamar la
  // función, React vuelve a renderizar el componente con el nuevo valor.

  // Producto seleccionado para ver su detalle (null = ninguno abierto).
  const [selectedProduct, setSelectedProduct] = useState<ShopProduct | null>(null);
  // ¿Está visible el formulario para apartar?
  const [showReserveForm, setShowReserveForm] = useState(false);
  // ¿Mostrar el popup de éxito tras apartar?
  const [showSuccess, setShowSuccess] = useState(false);
  // Categoría elegida en el filtro (null = "Todos").
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  // Índice de la imagen mostrada en grande dentro del detalle (galería).
  const [mainImageIdx, setMainImageIdx] = useState(0);
  // Página actual de la lista paginada de productos.
  const [page, setPage] = useState(1);

  // Estado del formulario de apartado, todo en un solo objeto para comodidad.
  const [form, setForm] = useState({
    quantity: 1,                  // cantidad a apartar
    customerName: '',             // nombre del cliente
    customerPhone: '',            // teléfono de contacto
    customerEmail: '',            // email (opcional)
    fulfillmentType: '',          // forma de entrega elegida
    preferredPaymentMethod: '',   // forma de pago elegida
    shippingAddress: '',          // dirección (si es envío)
    notes: '',                    // notas adicionales
  });
  // Mensaje de error de validación del formulario ('' = sin error).
  const [formError, setFormError] = useState('');

  // ── QUERY 1: configuración de la tienda ──
  // useQuery descarga datos del servidor y los cachea.
  //   - queryKey: identificador único del dato en el cache. Si cambia (porque
  //     cambia tenantSlug), react-query vuelve a pedir.
  //   - queryFn: función async que hace el fetch y devuelve los datos.
  const { data: settingsData } = useQuery({
    queryKey: ['shop-settings', tenantSlug],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/public/${tenantSlug}/shop/settings`);
      if (!res.ok) return null;       // si la respuesta falla, devolvemos null
      return res.json();               // si va bien, parseamos el JSON
    },
  });

  // Extraemos los settings. ?.data evita error si settingsData es undefined
  // (optional chaining). || null da un valor por defecto.
  const settings: ShopSettings | null = settingsData?.data || null;

  // ── QUERY 2: lista de productos (paginada y filtrada por categoría) ──
  const { data: productsData, isLoading } = useQuery({
    // La key incluye categoría y página: al cambiar cualquiera, se recarga.
    queryKey: ['shop-products', tenantSlug, selectedCategory, page],
    queryFn: async () => {
      // URLSearchParams construye el "?page=1&perPage=12" de la URL.
      const params = new URLSearchParams({ page: String(page), perPage: '12' });
      if (selectedCategory) params.set('category', selectedCategory);
      const res = await fetch(`${API_URL}/api/public/${tenantSlug}/shop/products?${params}`);
      if (!res.ok) return null;
      return res.json();
    },
    // enabled: la query SOLO se ejecuta cuando la tienda está habilitada.
    // Así no pedimos productos de una tienda apagada.
    enabled: !!settings?.shopEnabled,
  });

  // Lista de productos (o [] si aún no hay datos) y metadatos de paginación.
  const products: ShopProduct[] = productsData?.data || [];
  const meta = productsData?.meta;

  // Categorías únicas presentes en los productos cargados, para el filtro:
  //   - products.map((p) => p.category)  → array de categorías (con repetidos)
  //   - .filter(Boolean)  → quita las vacías/undefined
  //   - new Set(...)  → elimina duplicados
  //   - [...]  → vuelve a convertir el Set en array
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))] as string[];

  // ── MUTATION: apartar (reservar) un producto ──
  // useMutation se usa para acciones que MODIFICAN datos en el servidor.
  const reserveMutation = useMutation({
    // mutationFn: recibe el cuerpo (body) y hace el POST de reserva.
    mutationFn: async (body: any) => {
      const res = await fetch(`${API_URL}/api/public/${tenantSlug}/shop/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, // enviamos JSON
        body: JSON.stringify(body),                       // objeto → texto JSON
      });
      // Si el servidor responde con error, lanzamos una excepción con su
      // mensaje para que la capture onError (abajo).
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Error al apartar producto');
      }
      return res.json();
    },
    // onSuccess: se ejecuta si la mutación terminó bien. Cerramos modales,
    // mostramos el popup de éxito y reseteamos el formulario.
    onSuccess: () => {
      setShowReserveForm(false);
      setSelectedProduct(null);
      setShowSuccess(true);
      setForm({
        quantity: 1, customerName: '', customerPhone: '', customerEmail: '',
        fulfillmentType: '', preferredPaymentMethod: '', shippingAddress: '', notes: '',
      });
      setFormError('');
    },
    // onError: si algo falla, mostramos el mensaje de error en el formulario.
    onError: (err: any) => {
      setFormError(err.message || 'Error al apartar');
    },
  });

  // Renderizado condicional a nivel componente: si la tienda está apagada, o
  // ya terminó de cargar y no hay productos, no mostramos nada (return null).
  if (!settings?.shopEnabled || (!isLoading && products.length === 0)) return null;

  // handleReserve: valida el formulario y, si todo está bien, dispara la
  // mutación de apartado. Cada validación devuelve (return) un setFormError
  // para detenerse en el primer error encontrado.
  const handleReserve = () => {
    setFormError(''); // limpiamos error previo
    // .trim() quita espacios al inicio/fin para no aceptar campos "en blanco".
    if (!form.customerName.trim()) return setFormError('Ingresa tu nombre');
    if (!form.customerPhone.trim() || form.customerPhone.length < 7) return setFormError('Ingresa un telefono valido');
    if (!form.fulfillmentType) return setFormError('Selecciona forma de entrega');
    if (!form.preferredPaymentMethod) return setFormError('Selecciona forma de pago');
    // La dirección solo es obligatoria si la entrega es por envío a domicilio.
    if (form.fulfillmentType === 'SHIPPING' && !form.shippingAddress.trim()) return setFormError('Ingresa tu direccion de envio');

    // .mutate(...) lanza la petición de apartado con el cuerpo armado abajo.
    reserveMutation.mutate({
      // selectedProduct!.id  → el "!" le dice a TypeScript "confía, aquí NO es
      // null" (sabemos que hay producto porque el formulario está abierto).
      productId: selectedProduct!.id,
      quantity: form.quantity,
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim(),
      // Si el email quedó vacío, mandamos undefined (campo opcional) en vez de
      // una cadena vacía.
      customerEmail: form.customerEmail.trim() || undefined,
      fulfillmentType: form.fulfillmentType,
      preferredPaymentMethod: form.preferredPaymentMethod,
      // Solo incluimos dirección si es envío; si es recoger, undefined.
      shippingAddress: form.fulfillmentType === 'SHIPPING' ? form.shippingAddress.trim() : undefined,
      notes: form.notes.trim() || undefined,
    });
  };

  // getAllImages: arma la lista completa de imágenes de un producto, evitando
  // duplicar la imagen principal. Recibe el producto y devuelve un array de
  // rutas (string[]).
  const getAllImages = (product: ShopProduct) => {
    const imgs: string[] = [];                  // acumulador de rutas
    if (product.imageUrl) imgs.push(product.imageUrl); // primero la principal
    // .forEach recorre cada imagen de la galería; "img" es cada una.
    product.images.forEach((img) => {
      // Solo la agregamos si NO es igual a la principal (para no repetirla).
      if (img.imageUrl !== product.imageUrl) imgs.push(img.imageUrl);
    });
    return imgs;
  };

  return (
    // <>...</> es un Fragment: agrupa la tarjeta de la tienda y los modales sin
    // añadir un contenedor extra al HTML.
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Tienda</h2>
          {/* Contador de productos: usa el total del servidor (meta.total) o,
              si no llegó, la cantidad cargada en pantalla. */}
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: TEAL_LIGHT, color: TEAL }}>
            {meta?.total || products.length} productos
          </span>
        </div>

        {/* Filtro de categorías — solo si hay MÁS de una categoría (si no, no
            tiene sentido filtrar). */}
        {categories.length > 1 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {/* Pastilla "Todos": limpia el filtro y vuelve a la página 1. */}
            <button
              onClick={() => { setSelectedCategory(null); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                !selectedCategory ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
              style={!selectedCategory ? { backgroundColor: TEAL } : undefined}
            >
              Todos
            </button>
            {/* .map recorre cada categoría "cat" y genera una pastilla-botón.
                key={cat} ayuda a React a identificar cada elemento de la lista
                (debe ser único y estable). */}
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => { setSelectedCategory(cat); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedCategory === cat ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
                style={selectedCategory === cat ? { backgroundColor: TEAL } : undefined}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Cuadrícula de productos.
            Ternario principal: SI isLoading (cargando) mostramos "esqueletos"
            grises animados; SI NO, mostramos los productos reales. */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* 6 placeholders. "i" es el número de cada uno (1..6) y sirve de key. */}
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square bg-gray-200 rounded-xl mb-2" />
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-1" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {products.map((product) => (
              <button
                key={product.id}
                onClick={() => { setSelectedProduct(product); setMainImageIdx(0); }}
                className="text-left group"
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-gray-100 mb-2 relative">
                  {product.imageUrl ? (
                    <img
                      src={`${API_URL}${product.imageUrl}`}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                      </svg>
                    </div>
                  )}
                  {product.stock <= 3 && product.stock > 0 && (
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-bold rounded-md">
                      Quedan {product.stock}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                <p className="text-sm font-bold" style={{ color: TEAL }}>
                  {formatCurrency(Number(product.price))}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Load More */}
        {meta && meta.totalPages > 1 && page < meta.totalPages && (
          <button
            onClick={() => setPage((p) => p + 1)}
            className="w-full mt-4 py-2 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Ver mas productos
          </button>
        )}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && !showReserveForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => setSelectedProduct(null)}>
          <div
            className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image Gallery */}
            {(() => {
              const imgs = getAllImages(selectedProduct);
              return imgs.length > 0 ? (
                <div>
                  <div className="relative aspect-square">
                    <img
                      src={`${API_URL}${imgs[mainImageIdx]}`}
                      alt={selectedProduct.name}
                      className="w-full h-full object-cover sm:rounded-t-2xl"
                    />
                    <button
                      onClick={() => setSelectedProduct(null)}
                      className="absolute top-3 right-3 w-8 h-8 bg-black/40 backdrop-blur rounded-full flex items-center justify-center text-white"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {imgs.length > 1 && (
                    <div className="flex gap-2 p-3">
                      {imgs.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setMainImageIdx(idx)}
                          className={`w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                            idx === mainImageIdx ? '' : 'border-transparent opacity-60'
                          }`}
                          style={idx === mainImageIdx ? { borderColor: TEAL } : undefined}
                        >
                          <img src={`${API_URL}${img}`} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <div className="aspect-video bg-gray-100 flex items-center justify-center sm:rounded-t-2xl">
                    <svg className="w-16 h-16 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                    </svg>
                  </div>
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="absolute top-3 right-3 w-8 h-8 bg-black/40 backdrop-blur rounded-full flex items-center justify-center text-white"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })()}

            {/* Product Info */}
            <div className="p-5">
              {selectedProduct.category && (
                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 mb-2">
                  {selectedProduct.category}
                </span>
              )}
              <h3 className="text-lg font-bold text-gray-900">{selectedProduct.name}</h3>
              <p className="text-xl font-bold mt-1" style={{ color: TEAL }}>
                {formatCurrency(Number(selectedProduct.price))}
              </p>

              {selectedProduct.stock <= 5 ? (
                <p className="text-xs text-amber-600 font-medium mt-2">
                  Ultimas {selectedProduct.stock} unidades
                </p>
              ) : (
                <p className="text-xs text-green-600 font-medium mt-2">Disponible</p>
              )}

              {selectedProduct.description && (
                <p className="text-sm text-gray-600 mt-3 leading-relaxed">{selectedProduct.description}</p>
              )}

              {/* Shipping Cost Info */}
              {settings?.fulfillmentOptions.includes('SHIPPING') && (
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0H6.375c-.621 0-1.125-.504-1.125-1.125v0c0-.621.504-1.125 1.125-1.125H20.25M3.75 18V7.5A2.25 2.25 0 0 1 6 5.25h12A2.25 2.25 0 0 1 20.25 7.5V18" />
                  </svg>
                  {!selectedProduct.shippingCost || Number(selectedProduct.shippingCost) === 0 ? (
                    <span className="text-green-600 font-medium">Envio gratis</span>
                  ) : (
                    <span className="text-gray-600">
                      Envio: <span className="font-semibold">{formatCurrency(Number(selectedProduct.shippingCost))}</span>
                    </span>
                  )}
                </div>
              )}

              <button
                onClick={() => {
                  setShowReserveForm(true);
                  if (settings && settings.fulfillmentOptions.length === 1) {
                    setForm((f) => ({ ...f, fulfillmentType: settings.fulfillmentOptions[0] }));
                  }
                  if (settings && settings.paymentMethods.length === 1) {
                    setForm((f) => ({ ...f, preferredPaymentMethod: settings.paymentMethods[0] }));
                  }
                }}
                className="w-full mt-5 py-3 text-white text-sm font-semibold rounded-xl transition-colors"
                style={{ backgroundColor: TEAL }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = TEAL_DARK)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL)}
              >
                Apartar este producto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reserve Form Modal */}
      {showReserveForm && selectedProduct && settings && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => setShowReserveForm(false)}>
          <div
            className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Apartar producto</h3>
                  <p className="text-xs text-gray-500">{selectedProduct.name}</p>
                </div>
                <button onClick={() => setShowReserveForm(false)} className="p-1 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Quantity */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Cantidad</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setForm((f) => ({ ...f, quantity: Math.max(1, f.quantity - 1) }))}
                    className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                  >
                    -
                  </button>
                  <span className="text-sm font-semibold w-8 text-center">{form.quantity}</span>
                  <button
                    onClick={() => setForm((f) => ({ ...f, quantity: Math.min(selectedProduct.stock, Math.min(10, f.quantity + 1)) }))}
                    className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                  >
                    +
                  </button>
                  <span className="text-sm font-bold ml-auto" style={{ color: TEAL }}>
                    {formatCurrency(Number(selectedProduct.price) * form.quantity + (form.fulfillmentType === 'SHIPPING' && selectedProduct.shippingCost ? Number(selectedProduct.shippingCost) : 0))}
                  </span>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Nombre completo *</label>
                  <input
                    type="text"
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                    placeholder="Tu nombre"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Telefono *</label>
                  <input
                    type="tel"
                    value={form.customerPhone}
                    onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                    placeholder="55 1234 5678"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Email (opcional)</label>
                  <input
                    type="email"
                    value={form.customerEmail}
                    onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                    placeholder="tu@email.com"
                  />
                </div>
              </div>

              {/* Fulfillment Type */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-2">Forma de entrega *</label>
                <div className="space-y-2">
                  {settings.fulfillmentOptions.map((opt) => (
                    <label
                      key={opt}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        form.fulfillmentType === opt ? 'border-teal-500 bg-teal-50/50' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="fulfillment"
                        checked={form.fulfillmentType === opt}
                        onChange={() => setForm({ ...form, fulfillmentType: opt })}
                        className="sr-only"
                      />
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          form.fulfillmentType === opt ? '' : 'border-gray-300'
                        }`}
                        style={form.fulfillmentType === opt ? { borderColor: TEAL } : undefined}
                      >
                        {form.fulfillmentType === opt && (
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: TEAL }} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{FULFILLMENT_LABELS[opt]}</p>
                        <p className="text-[10px] text-gray-500">
                          {opt === 'PICKUP' ? 'Recoge en el local del negocio' : (
                            !selectedProduct.shippingCost || Number(selectedProduct.shippingCost) === 0
                              ? 'Envio gratis a tu domicilio'
                              : `Envio: ${formatCurrency(Number(selectedProduct.shippingCost))}`
                          )}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Shipping Address */}
              {form.fulfillmentType === 'SHIPPING' && (
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Direccion de envio *</label>
                  <textarea
                    value={form.shippingAddress}
                    onChange={(e) => setForm({ ...form, shippingAddress: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none"
                    rows={2}
                    placeholder="Calle, numero, colonia, ciudad, CP"
                  />
                </div>
              )}

              {/* Payment Method */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-2">Forma de pago *</label>
                <div className="space-y-2">
                  {settings.paymentMethods.map((method) => (
                    <label
                      key={method}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        form.preferredPaymentMethod === method ? 'border-teal-500 bg-teal-50/50' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        checked={form.preferredPaymentMethod === method}
                        onChange={() => setForm({ ...form, preferredPaymentMethod: method })}
                        className="sr-only"
                      />
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          form.preferredPaymentMethod === method ? '' : 'border-gray-300'
                        }`}
                        style={form.preferredPaymentMethod === method ? { borderColor: TEAL } : undefined}
                      >
                        {form.preferredPaymentMethod === method && (
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: TEAL }} />
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900">{PAYMENT_LABELS[method]}</p>
                    </label>
                  ))}
                </div>
              </div>

              {/* SPEI Bank Details */}
              {form.preferredPaymentMethod === 'SPEI' && settings.speiInfo && (
                <div className="mb-4 rounded-lg p-3 border" style={{ backgroundColor: TEAL_LIGHT, borderColor: `${TEAL}30` }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: TEAL }}>Datos para transferencia</p>
                  <div className="space-y-1.5 text-xs text-gray-700">
                    {settings.speiInfo.bankName && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Banco:</span>
                        <span className="font-medium">{settings.speiInfo.bankName}</span>
                      </div>
                    )}
                    {settings.speiInfo.holderName && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Titular:</span>
                        <span className="font-medium">{settings.speiInfo.holderName}</span>
                      </div>
                    )}
                    {settings.speiInfo.clabe && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">CLABE:</span>
                        <span className="font-mono font-medium tracking-wider">{settings.speiInfo.clabe}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2">
                    Realiza la transferencia despues de que el negocio confirme tu apartado.
                  </p>
                </div>
              )}

              {/* Shipping cost summary */}
              {form.fulfillmentType === 'SHIPPING' && selectedProduct.shippingCost && Number(selectedProduct.shippingCost) > 0 && (
                <div className="mb-4 flex items-center justify-between text-xs px-3 py-2 bg-gray-50 rounded-lg">
                  <span className="text-gray-500">Costo de envio</span>
                  <span className="font-medium text-gray-900">{formatCurrency(Number(selectedProduct.shippingCost))}</span>
                </div>
              )}

              {/* Notes */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Notas (opcional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none"
                  rows={2}
                  placeholder="Indicaciones adicionales..."
                />
              </div>

              {/* Disclaimer */}
              <div className="rounded-lg p-3 mb-4 text-xs text-gray-500" style={{ backgroundColor: '#f8f9fa' }}>
                Al apartar este producto, el negocio se pondra en contacto contigo para coordinar el pago y la entrega. Siliba no procesa pagos de productos.
              </div>

              {/* Error */}
              {formError && (
                <div className="rounded-lg p-3 mb-4 bg-red-50 text-red-700 text-xs">
                  {formError}
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleReserve}
                disabled={reserveMutation.isPending}
                className="w-full py-3 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ backgroundColor: TEAL }}
                onMouseEnter={(e) => { if (!reserveMutation.isPending) e.currentTarget.style.backgroundColor = TEAL_DARK; }}
                onMouseLeave={(e) => { if (!reserveMutation.isPending) e.currentTarget.style.backgroundColor = TEAL; }}
              >
                {reserveMutation.isPending ? 'Apartando...' : `Apartar · ${formatCurrency(Number(selectedProduct.price) * form.quantity)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Popup */}
      <SuccessPopup
        show={showSuccess}
        title="Producto apartado"
        message="El negocio se pondra en contacto contigo para coordinar el pago y la entrega."
        onClose={() => setShowSuccess(false)}
      />
    </>
  );
}

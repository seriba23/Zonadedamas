'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/utils';
import { SuccessPopup } from '@/components/ui/success-popup';
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';
import { marketplaceApi } from '@/lib/marketplace-api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TEAL = '#008080';
const TEAL_DARK = '#006666';
const TEAL_LIGHT = '#e0f2f1';

interface ShopProduct {
  id: string;
  name: string;
  description?: string;
  category?: string;
  price: number;
  currency: string;
  stock: number;
  imageUrl?: string;
  shippingEnabled: boolean;
  shippingCost?: number;
  images: { id: string; imageUrl: string; sortOrder: number }[];
}

interface CartItem {
  product: ShopProduct;
  quantity: number;
}

interface SpeiInfo { bankName?: string; holderName?: string; clabe?: string; }

interface ShopSettings {
  shopEnabled: boolean;
  tenantName: string;
  paymentMethods: string[];
  fulfillmentOptions: string[];
  speiInfo?: SpeiInfo | null;
}

const PAYMENT_LABELS: Record<string, string> = { CASH: 'Efectivo', SPEI: 'SPEI / Transferencia', CARD: 'Tarjeta (en terminal)' };
const FULFILLMENT_LABELS: Record<string, string> = { PICKUP: 'Recoger en tienda', SHIPPING: 'Envio a domicilio' };

// ─── Cart Helpers ──────────────────────────────

function buildAddress(f: { addrStreet: string; addrNumber: string; addrColonia: string; addrCity: string; addrState: string; addrPostalCode: string; addrCountry: string }) {
  return [
    [f.addrStreet, f.addrNumber].filter(Boolean).join(' '),
    f.addrColonia, f.addrCity, f.addrState, f.addrPostalCode, f.addrCountry,
  ].filter(Boolean).join(', ');
}

// ─── Page ──────────────────────────────────────

export default function ShopPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;
  const { user, isAuthenticated } = useMarketplaceAuth();

  // UI state
  const [selectedProduct, setSelectedProduct] = useState<ShopProduct | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [mainImageIdx, setMainImageIdx] = useState(0);
  const [page, setPage] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  // Checkout form
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', customerEmail: '',
    fulfillmentType: '', preferredPaymentMethod: '',
    useProfileAddress: true,
    addrStreet: '', addrNumber: '', addrColonia: '', addrCity: '', addrState: '', addrPostalCode: '', addrCountry: '',
    notes: '',
  });
  const [formError, setFormError] = useState('');

  // Data
  const { data: settingsData } = useQuery({
    queryKey: ['shop-settings', tenantSlug],
    queryFn: async () => { const r = await fetch(`${API_URL}/api/public/${tenantSlug}/shop/settings`); return r.ok ? r.json() : null; },
  });
  const settings: ShopSettings | null = settingsData?.data || null;

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['shop-products', tenantSlug],
    queryFn: async () => { const r = await fetch(`${API_URL}/api/public/${tenantSlug}/shop/products?perPage=100`); return r.ok ? r.json() : null; },
    enabled: !!settings?.shopEnabled,
  });

  const allProducts: ShopProduct[] = productsData?.data || [];
  const categories = [...new Set(allProducts.map((p) => p.category).filter(Boolean))] as string[];
  const filtered = allProducts.filter((p) => {
    if (selectedCategory && p.category !== selectedCategory) return false;
    if (search) { const q = search.toLowerCase(); if (!p.name.toLowerCase().includes(q) && !(p.description || '').toLowerCase().includes(q)) return false; }
    return true;
  });
  const perPage = 12;
  const totalPages = Math.ceil(filtered.length / perPage);
  const products = filtered.slice((page - 1) * perPage, page * perPage);

  // Cart functions
  const addToCart = (product: ShopProduct, qty: number = 1) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        return prev.map((c) => c.product.id === product.id ? { ...c, quantity: Math.min(product.stock, c.quantity + qty) } : c);
      }
      return [...prev, { product, quantity: qty }];
    });
  };

  const removeFromCart = (productId: string) => setCart((prev) => prev.filter((c) => c.product.id !== productId));

  const updateCartQty = (productId: string, qty: number) => {
    setCart((prev) => prev.map((c) => c.product.id === productId ? { ...c, quantity: Math.max(1, Math.min(c.product.stock, qty)) } : c));
  };

  const cartTotal = cart.reduce((sum, c) => sum + Number(c.product.price) * c.quantity, 0);
  const cartShipping = cart.reduce((sum, c) => sum + (c.product.shippingEnabled && c.product.shippingCost ? Number(c.product.shippingCost) : 0), 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  const fc = (amount: number) => formatCurrency(amount, cart[0]?.product.currency || 'MXN');

  // Checkout
  const getShippingAddress = () => {
    if (form.fulfillmentType !== 'SHIPPING') return undefined;
    if (form.useProfileAddress && user?.address) return user.address;
    return buildAddress(form);
  };

  const reserveMutation = useMutation({
    mutationFn: async (body: any) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = marketplaceApi.getAccessToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const r = await fetch(`${API_URL}/api/public/${tenantSlug}/shop/reserve-batch`, {
        method: 'POST', headers, body: JSON.stringify(body),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.message || 'Error al apartar'); }
      return r.json();
    },
    onSuccess: () => {
      setShowCheckout(false);
      setShowCart(false);
      setCart([]);
      setShowSuccess(true);
      setFormError('');
    },
    onError: (err: any) => setFormError(err.message || 'Error al apartar'),
  });

  const handleCheckout = () => {
    setFormError('');
    if (!isAuthenticated) {
      if (!form.customerName.trim()) return setFormError('Ingresa tu nombre');
      if (!form.customerPhone.trim()) return setFormError('Ingresa tu telefono');
    }
    if (!form.fulfillmentType) return setFormError('Selecciona forma de entrega');
    if (!form.preferredPaymentMethod) return setFormError('Selecciona forma de pago');
    const address = getShippingAddress();
    if (form.fulfillmentType === 'SHIPPING' && !address?.trim()) return setFormError('Ingresa tu direccion de envio');

    reserveMutation.mutate({
      items: cart.map((c) => ({ productId: c.product.id, quantity: c.quantity })),
      customerName: isAuthenticated && user ? `${user.firstName} ${user.lastName}` : form.customerName.trim(),
      customerPhone: isAuthenticated && user?.phone ? user.phone : form.customerPhone.trim(),
      customerEmail: isAuthenticated && user ? user.email : (form.customerEmail.trim() || undefined),
      fulfillmentType: form.fulfillmentType,
      preferredPaymentMethod: form.preferredPaymentMethod,
      shippingAddress: address?.trim() || undefined,
      notes: form.notes.trim() || undefined,
    });
  };

  const getAllImages = (p: ShopProduct) => {
    const imgs: string[] = [];
    if (p.imageUrl) imgs.push(p.imageUrl);
    p.images.forEach((img) => { if (img.imageUrl !== p.imageUrl) imgs.push(img.imageUrl); });
    return imgs;
  };

  // ─── Render ──────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
            <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-gray-900">Tienda {settings?.tenantName || ''}</h1>
            <p className="text-[10px] text-gray-500">{filtered.length} producto{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          {/* Cart button */}
          <button onClick={() => setShowCart(true)} className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100">
            <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ backgroundColor: TEAL }}>{cartCount}</span>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Search + filtros (icono) — mismo patron que /marketplace */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-0">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar producto..." className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:border-transparent"
              onFocus={(e) => { e.currentTarget.style.borderColor = TEAL; e.currentTarget.style.boxShadow = `0 0 0 2px rgba(0,128,128,0.25)`; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>
          {categories.length > 0 && (
            <button
              onClick={() => setShowFiltersSheet(true)}
              title="Filtros"
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 relative transition-colors"
              style={selectedCategory
                ? { backgroundColor: TEAL, color: 'white', border: '1.5px solid ' + TEAL }
                : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
              }
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              {selectedCategory && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-gray-50" />
              )}
            </button>
          )}
        </div>

        {/* Product Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4,5,6].map((i) => (<div key={i} className="animate-pulse"><div className="aspect-square bg-gray-200 rounded-xl mb-2" /><div className="h-4 bg-gray-200 rounded w-3/4 mb-1" /><div className="h-4 bg-gray-200 rounded w-1/2" /></div>))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-sm">No hay productos disponibles</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((product) => {
              const inCart = cart.find((c) => c.product.id === product.id);
              return (
                <div key={product.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-all hover:shadow-md flex flex-col">
                  <button onClick={() => { setSelectedProduct(product); setMainImageIdx(0); }} className="text-left w-full group flex-shrink-0">
                    <div className="aspect-square overflow-hidden bg-gray-100 relative">
                      {product.imageUrl ? (
                        <img src={`${API_URL}${product.imageUrl}`} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" /></svg>
                        </div>
                      )}
                      {product.stock <= 3 && product.stock > 0 && (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-bold rounded-md">Quedan {product.stock}</span>
                      )}
                    </div>
                  </button>
                  {/* Info + Add to cart */}
                  <div className="flex-1 flex flex-col p-3">
                    <button onClick={() => { setSelectedProduct(product); setMainImageIdx(0); }} className="text-left flex-1">
                      <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight min-h-[2.5rem]">{product.name}</p>
                      <p className="text-sm font-bold mt-1" style={{ color: TEAL }}>{formatCurrency(Number(product.price), product.currency || 'MXN')}</p>
                    </button>
                    <div className="mt-2">
                    {inCart ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button onClick={() => inCart.quantity <= 1 ? removeFromCart(product.id) : updateCartQty(product.id, inCart.quantity - 1)}
                            className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 text-sm">-</button>
                          <span className="text-sm font-semibold w-5 text-center">{inCart.quantity}</span>
                          <button onClick={() => updateCartQty(product.id, inCart.quantity + 1)}
                            className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 text-sm">+</button>
                        </div>
                        <button onClick={() => removeFromCart(product.id)} className="text-[10px] text-red-500 hover:text-red-700">Quitar</button>
                      </div>
                    ) : (
                      <button onClick={() => addToCart(product)}
                        className="w-full py-1.5 text-xs font-medium rounded-lg text-white transition-colors" style={{ backgroundColor: TEAL }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = TEAL_DARK}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = TEAL}
                      >Anadir al carrito</button>
                    )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50">Anterior</button>
            <span className="text-xs text-gray-500">{page} de {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50">Siguiente</button>
          </div>
        )}
      </div>

      {/* Floating cart bar — encima del bottom nav, mismo patron que
          "Reservar cita" del perfil del negocio. */}
      {cartCount > 0 && !showCart && !showCheckout && !selectedProduct && (
        <div className="fixed bottom-20 left-0 right-0 px-4 pointer-events-none z-40">
          <div className="max-w-lg mx-auto pointer-events-auto">
            <button onClick={() => setShowCart(true)}
              className="w-full py-3 rounded-2xl text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg"
              style={{ backgroundColor: TEAL, boxShadow: '0 4px 16px rgba(0,128,128,0.4)' }}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
              Ver carrito ({cartCount}) · {fc(cartTotal)}
            </button>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && !showCart && !showCheckout && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => setSelectedProduct(null)}>
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto pb-24 sm:pb-0" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const imgs = getAllImages(selectedProduct);
              return imgs.length > 0 ? (
                <div>
                  <div className="relative aspect-square">
                    <img src={`${API_URL}${imgs[mainImageIdx]}`} alt={selectedProduct.name} className="w-full h-full object-cover sm:rounded-t-2xl" />
                    <button onClick={() => setSelectedProduct(null)} className="absolute top-3 right-3 w-8 h-8 bg-black/40 backdrop-blur rounded-full flex items-center justify-center text-white">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  {imgs.length > 1 && (
                    <div className="flex gap-2 p-3">
                      {imgs.map((img, idx) => (
                        <button key={idx} onClick={() => setMainImageIdx(idx)}
                          className={`w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${idx === mainImageIdx ? '' : 'border-transparent opacity-60'}`}
                          style={idx === mainImageIdx ? { borderColor: TEAL } : undefined}>
                          <img src={`${API_URL}${img}`} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <div className="aspect-video bg-gray-100 flex items-center justify-center sm:rounded-t-2xl">
                    <svg className="w-16 h-16 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" /></svg>
                  </div>
                  <button onClick={() => setSelectedProduct(null)} className="absolute top-3 right-3 w-8 h-8 bg-black/40 backdrop-blur rounded-full flex items-center justify-center text-white">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              );
            })()}
            <div className="p-5">
              {selectedProduct.category && <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 mb-2">{selectedProduct.category}</span>}
              <h3 className="text-lg font-bold text-gray-900">{selectedProduct.name}</h3>
              <p className="text-xl font-bold mt-1" style={{ color: TEAL }}>{formatCurrency(Number(selectedProduct.price), selectedProduct.currency || 'MXN')}</p>
              {selectedProduct.stock <= 5 ? (
                <p className="text-xs text-amber-600 font-medium mt-2">Ultimas {selectedProduct.stock} unidades</p>
              ) : (<p className="text-xs text-green-600 font-medium mt-2">Disponible</p>)}
              {selectedProduct.description && <p className="text-sm text-gray-600 mt-3 leading-relaxed">{selectedProduct.description}</p>}
              <div className="mt-3 flex items-center gap-2 text-xs">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0H6.375c-.621 0-1.125-.504-1.125-1.125v0c0-.621.504-1.125 1.125-1.125H20.25M3.75 18V7.5A2.25 2.25 0 0 1 6 5.25h12A2.25 2.25 0 0 1 20.25 7.5V18" />
                </svg>
                {selectedProduct.shippingEnabled ? <span className="text-green-600 font-medium">Envio disponible</span> : <span className="text-gray-500">Solo recoger en tienda</span>}
              </div>
              <button onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}
                className="w-full mt-5 py-3 text-white text-sm font-semibold rounded-xl transition-colors" style={{ backgroundColor: TEAL }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = TEAL_DARK}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = TEAL}>
                Anadir al carrito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      {showCart && !showCheckout && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => setShowCart(false)}>
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto pb-24 sm:pb-0" onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Carrito ({cartCount})</h3>
                <button onClick={() => setShowCart(false)} className="p-1 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-10">
                  <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                  </svg>
                  <p className="text-sm text-gray-500">Tu carrito esta vacio</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 mb-4">
                    {cart.map((item) => (
                      <div key={item.product.id} className="flex gap-3 p-3 rounded-lg border border-gray-100">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                          {item.product.imageUrl ? (
                            <img src={`${API_URL}${item.product.imageUrl}`} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159" /></svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.product.name}</p>
                          <p className="text-xs font-semibold mt-0.5" style={{ color: TEAL }}>{formatCurrency(Number(item.product.price), item.product.currency || 'MXN')}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <button onClick={() => item.quantity <= 1 ? removeFromCart(item.product.id) : updateCartQty(item.product.id, item.quantity - 1)}
                              className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 text-xs">-</button>
                            <span className="text-xs font-semibold w-4 text-center">{item.quantity}</span>
                            <button onClick={() => updateCartQty(item.product.id, item.quantity + 1)}
                              className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 text-xs">+</button>
                            <button onClick={() => removeFromCart(item.product.id)} className="ml-auto text-[10px] text-red-500 hover:text-red-700">Quitar</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="border-t border-gray-100 pt-3 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="font-semibold text-gray-900">{fc(cartTotal)}</span>
                    </div>
                  </div>

                  <button onClick={() => {
                    setShowCheckout(true);
                    if (isAuthenticated && user) {
                      setForm((f) => ({ ...f, customerName: `${user.firstName} ${user.lastName}`, customerPhone: user.phone || '', customerEmail: user.email || '', }));
                    }
                    if (settings) {
                      const hasSomeShipping = cart.some((c) => c.product.shippingEnabled);
                      const fulfillOpts = settings.fulfillmentOptions.filter((o) => o === 'PICKUP' || (o === 'SHIPPING' && hasSomeShipping));
                      if (fulfillOpts.length === 1) setForm((f) => ({ ...f, fulfillmentType: fulfillOpts[0] }));
                      if (settings.paymentMethods.length === 1) setForm((f) => ({ ...f, preferredPaymentMethod: settings.paymentMethods[0] }));
                    }
                  }}
                    className="w-full py-3 text-white text-sm font-semibold rounded-xl transition-colors" style={{ backgroundColor: TEAL }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = TEAL_DARK}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = TEAL}>
                    Proceder al pago · {fc(cartTotal)}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal — el panel deja un padding-bottom amplio para que
          el boton "Confirmar apartado" no quede oculto detras del bottom nav. */}
      {showCheckout && settings && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => setShowCheckout(false)}>
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto pb-24 sm:pb-0" onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Confirmar apartado</h3>
                  <p className="text-xs text-gray-500">{cartCount} producto{cartCount !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => setShowCheckout(false)} className="p-1 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Order Summary */}
              <div className="rounded-lg border border-gray-100 p-3 mb-4">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Resumen</p>
                {cart.map((item) => (
                  <div key={item.product.id} className="flex items-center justify-between text-xs py-1.5">
                    <span className="text-gray-700 truncate flex-1 mr-2">{item.quantity}x {item.product.name}</span>
                    <span className="font-medium text-gray-900 flex-shrink-0">{formatCurrency(Number(item.product.price) * item.quantity, item.product.currency || 'MXN')}</span>
                  </div>
                ))}
                <div className="border-t border-gray-100 mt-2 pt-2 flex justify-between text-sm font-semibold">
                  <span>Total</span>
                  <span style={{ color: TEAL }}>{fc(cartTotal)}</span>
                </div>
              </div>

              {/* Contact */}
              {isAuthenticated && user ? (
                <div className="mb-4 rounded-lg border border-gray-200 p-3">
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Datos de contacto</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between"><span className="text-xs text-gray-500">Nombre</span><span className="text-xs font-medium text-gray-900">{user.firstName} {user.lastName}</span></div>
                    {user.phone && <div className="flex items-center justify-between"><span className="text-xs text-gray-500">Telefono</span><span className="text-xs font-medium text-gray-900">{user.phone}</span></div>}
                    <div className="flex items-center justify-between"><span className="text-xs text-gray-500">Email</span><span className="text-xs font-medium text-gray-900">{user.email}</span></div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 mb-4">
                  <div><label className="block text-xs font-medium text-gray-700 mb-1.5">Nombre completo *</label><input type="text" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" placeholder="Tu nombre" /></div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1.5">Telefono *</label><input type="tel" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" placeholder="55 1234 5678" /></div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1.5">Email (opcional)</label><input type="email" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" placeholder="tu@email.com" /></div>
                </div>
              )}

              {/* Fulfillment */}
              {(() => {
                const hasSomeShipping = cart.some((c) => c.product.shippingEnabled);
                const fulfillOpts = settings.fulfillmentOptions.filter((o) => o === 'PICKUP' || (o === 'SHIPPING' && hasSomeShipping));
                return (
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-700 mb-2">Forma de entrega *</label>
                    <div className="space-y-2">
                      {fulfillOpts.map((opt) => (
                        <label key={opt} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${form.fulfillmentType === opt ? 'border-teal-500 bg-teal-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                          <input type="radio" name="fulfillment" checked={form.fulfillmentType === opt} onChange={() => setForm({ ...form, fulfillmentType: opt })} className="sr-only" />
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${form.fulfillmentType === opt ? '' : 'border-gray-300'}`} style={form.fulfillmentType === opt ? { borderColor: TEAL } : undefined}>
                            {form.fulfillmentType === opt && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: TEAL }} />}
                          </div>
                          <div><p className="text-sm font-medium text-gray-900">{FULFILLMENT_LABELS[opt]}</p></div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Shipping Address */}
              {form.fulfillmentType === 'SHIPPING' && (
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 mb-2">Direccion de envio *</label>
                  <div className="space-y-2">
                    {user?.address && (
                      <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${form.useProfileAddress ? 'border-teal-500 bg-teal-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <input type="radio" name="shippingAddr" className="sr-only" checked={form.useProfileAddress} onChange={() => setForm({ ...form, useProfileAddress: true })} />
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${form.useProfileAddress ? '' : 'border-gray-300'}`} style={form.useProfileAddress ? { borderColor: TEAL } : undefined}>
                          {form.useProfileAddress && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: TEAL }} />}
                        </div>
                        <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900">Mi direccion</p><p className="text-xs text-gray-500 mt-0.5">{user.address}</p></div>
                      </label>
                    )}
                    <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${!form.useProfileAddress || !user?.address ? 'border-teal-500 bg-teal-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="radio" name="shippingAddr" className="sr-only" checked={!form.useProfileAddress || !user?.address} onChange={() => setForm({ ...form, useProfileAddress: false })} />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${(!form.useProfileAddress || !user?.address) ? '' : 'border-gray-300'}`} style={(!form.useProfileAddress || !user?.address) ? { borderColor: TEAL } : undefined}>
                        {(!form.useProfileAddress || !user?.address) && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: TEAL }} />}
                      </div>
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900">Otra direccion</p></div>
                    </label>
                    {(!form.useProfileAddress || !user?.address) && (
                      <div className="space-y-2 pl-3 border-l-2" style={{ borderColor: `${TEAL}40` }}>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2"><input type="text" value={form.addrStreet} onChange={(e) => setForm({ ...form, addrStreet: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" placeholder="Calle" /></div>
                          <input type="text" value={form.addrNumber} onChange={(e) => setForm({ ...form, addrNumber: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" placeholder="Numero" />
                        </div>
                        <input type="text" value={form.addrColonia} onChange={(e) => setForm({ ...form, addrColonia: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" placeholder="Colonia / Fraccionamiento" />
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" value={form.addrCity} onChange={(e) => setForm({ ...form, addrCity: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" placeholder="Ciudad" />
                          <input type="text" value={form.addrState} onChange={(e) => setForm({ ...form, addrState: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" placeholder="Estado" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" value={form.addrPostalCode} onChange={(e) => setForm({ ...form, addrPostalCode: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" placeholder="Codigo postal" />
                          <input type="text" value={form.addrCountry} onChange={(e) => setForm({ ...form, addrCountry: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" placeholder="Pais" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Payment */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-2">Forma de pago *</label>
                <div className="space-y-2">
                  {settings.paymentMethods.map((method) => (
                    <label key={method} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${form.preferredPaymentMethod === method ? 'border-teal-500 bg-teal-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="radio" name="payment" checked={form.preferredPaymentMethod === method} onChange={() => setForm({ ...form, preferredPaymentMethod: method })} className="sr-only" />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${form.preferredPaymentMethod === method ? '' : 'border-gray-300'}`} style={form.preferredPaymentMethod === method ? { borderColor: TEAL } : undefined}>
                        {form.preferredPaymentMethod === method && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: TEAL }} />}
                      </div>
                      <p className="text-sm font-medium text-gray-900">{PAYMENT_LABELS[method]}</p>
                    </label>
                  ))}
                </div>
              </div>

              {/* SPEI Info */}
              {form.preferredPaymentMethod === 'SPEI' && settings.speiInfo && (
                <div className="mb-4 rounded-lg p-3 border" style={{ backgroundColor: TEAL_LIGHT, borderColor: `${TEAL}30` }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: TEAL }}>Datos para transferencia</p>
                  <div className="space-y-1.5 text-xs text-gray-700">
                    {settings.speiInfo.bankName && <div className="flex justify-between"><span className="text-gray-500">Banco:</span><span className="font-medium">{settings.speiInfo.bankName}</span></div>}
                    {settings.speiInfo.holderName && <div className="flex justify-between"><span className="text-gray-500">Titular:</span><span className="font-medium">{settings.speiInfo.holderName}</span></div>}
                    {settings.speiInfo.clabe && <div className="flex justify-between"><span className="text-gray-500">CLABE:</span><span className="font-mono font-medium tracking-wider">{settings.speiInfo.clabe}</span></div>}
                  </div>
                  <div className="mt-3 pt-2 border-t" style={{ borderColor: `${TEAL}20` }}>
                    <div className="flex items-start gap-1.5">
                      <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                      </svg>
                      <p className="text-[10px] text-gray-600 leading-relaxed">
                        Una vez realizada la transferencia, deberas enviar una <span className="font-semibold">captura de pantalla</span> del comprobante de pago al negocio. Tu apartado sera confirmado por el administrador al verificar el pago.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Notas (opcional)</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none" rows={2} placeholder="Indicaciones adicionales..." />
              </div>

              {/* Disclaimer */}
              <div className="rounded-lg p-3 mb-4 text-xs text-gray-500" style={{ backgroundColor: '#f8f9fa' }}>
                Al apartar, el negocio se pondra en contacto contigo para coordinar el pago y la entrega. Siliba no procesa pagos de productos.
              </div>

              {formError && <div className="rounded-lg p-3 mb-4 bg-red-50 text-red-700 text-xs">{formError}</div>}

              <button onClick={handleCheckout} disabled={reserveMutation.isPending}
                className="w-full py-3 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50" style={{ backgroundColor: TEAL }}
                onMouseEnter={(e) => { if (!reserveMutation.isPending) e.currentTarget.style.backgroundColor = TEAL_DARK; }}
                onMouseLeave={(e) => { if (!reserveMutation.isPending) e.currentTarget.style.backgroundColor = TEAL; }}>
                {reserveMutation.isPending ? 'Apartando...' : `Confirmar apartado · ${fc(cartTotal)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filtros (categorías) — bottom sheet */}
      {showFiltersSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ touchAction: 'none' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowFiltersSheet(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl shadow-xl pb-safe">
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Filtros</h3>
              <button onClick={() => setShowFiltersSheet(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-5 py-4">
              {selectedCategory && (
                <button
                  onClick={() => { setSelectedCategory(null); setPage(1); }}
                  className="w-full flex items-center justify-center gap-1.5 mb-4 py-2 rounded-xl text-xs font-medium border transition-colors"
                  style={{ color: '#dc2626', borderColor: '#fecaca', backgroundColor: '#fef2f2' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  Limpiar filtros
                </button>
              )}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Categoría</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => { setSelectedCategory(null); setPage(1); setShowFiltersSheet(false); }}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                  style={!selectedCategory
                    ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
                    : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                  }
                >
                  Todos
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setSelectedCategory(cat); setPage(1); setShowFiltersSheet(false); }}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                    style={selectedCategory === cat
                      ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
                      : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                    }
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-4 py-4" />
          </div>
        </div>
      )}

      <SuccessPopup show={showSuccess} title="Productos apartados" message="El negocio se pondra en contacto contigo para coordinar el pago y la entrega." onClose={() => setShowSuccess(false)} />
    </div>
  );
}

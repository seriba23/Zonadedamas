// 'use client': componente de navegador con estado complejo y efectos.
'use client';

// useState: múltiples estados del POS (paso actual, carrito, descuento, propina, etc.).
// useEffect: efectos para pre-cargar datos de cita/apartado seleccionado.
// useRef: referencia mutable para evitar recargas duplicadas.
import { useState, useEffect, useRef } from 'react';
// useQuery: para cargar listas (citas, servicios, productos, empleados, clientes, ubicaciones).
// useMutation: para registrar pagos y crear clientes.
// useQueryClient: para invalidar caché y actualizar listas tras una venta.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// QRCodeSVG: genera un código QR SVG a partir de una URL (para que el cliente deje reseña).
import { QRCodeSVG } from 'qrcode.react';
// api: cliente HTTP del proyecto (GET/POST/upload).
import { api } from '@/lib/api';
// RebookPromptModal: modal de "¿Agendar nueva cita?" al cerrar la venta.
import { RebookPromptModal } from '@/components/ui/rebook-prompt-modal';
// useCurrency: hook que devuelve formatCurrency para mostrar precios formateados.
import { useCurrency } from '@/lib/hooks/use-currency';
// SearchableSelect: combo con búsqueda para seleccionar clientes/ubicaciones.
import { SearchableSelect } from '@/components/ui/searchable-select';
// Modal: diálogo/overlay reutilizable del proyecto.
import { Modal } from '@/components/ui/modal';
// Utilidades de formato de hora/día para mostrar citas en la pantalla de inicio del POS.
import { formatBookingTime, formatBookingDay, formatBookingMonthShort } from '@/lib/booking-time';

// API_URL: URL base del backend para construir URLs de imágenes.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// CartItem: interfaz que describe cada elemento del carrito de venta.
// type: distingue entre servicio (requiere asignar empleado) y producto (stock).
// imageUrl: ruta relativa de la imagen del producto (opcional).
// employeeId/employeeName: empleado que realizará el servicio (solo para type='service').
// duration: duración en minutos del servicio (para informar al cajero).
interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  type: 'service' | 'product';
  imageUrl?: string;
  employeeId?: string;
  employeeName?: string;
  duration?: number;
}

// PaymentMethod: unión de tipos de pago disponibles en el POS.
type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER';

// Step: los 6 pasos del flujo POS.
// 'start' → seleccionar cita o crear venta nueva
// 'services' → agregar servicios al carrito
// 'products' → agregar productos al carrito
// 'details' → confirmar cliente, ubicación, descuento, propina
// 'pay' → método de pago + ejecutar cobro
// 'receipt' → comprobante + QR de reseña
type Step = 'start' | 'services' | 'products' | 'details' | 'pay' | 'receipt';

// PosCheckoutProps: props que recibe el componente POS.
// onComplete: callback que el padre llama cuando el cajero termina (cierra el POS).
// initialAppointmentId: si se pasa, el POS carga la cita directamente en 'details'.
// initialReservationId: si se pasa, el POS carga el apartado directamente en 'details'.
interface PosCheckoutProps {
  onComplete: () => void;
  /** Si viene una cita preseleccionada (ej: desde "Proceder al pago" en el
   * detalle de cita), el POS arranca con ella ya cargada en el step de
   * detalles, listo para cobrar. */
  initialAppointmentId?: string;
  /** Apartado standalone preseleccionado desde el detalle del apartado
   * en /reservations con el boton "Cobrar ahora". */
  initialReservationId?: string;
}

// PosCheckout: componente principal del punto de venta (POS).
// Gestiona todo el flujo de cobro: selección de cita/apartado, carrito,
// descuentos, propina, método de pago, comprobante y QR de reseña.
export function PosCheckout({ onComplete, initialAppointmentId, initialReservationId }: PosCheckoutProps) {
  // formatCurrency: función que formatea un número como moneda local (p.ej. $1,500.00).
  const { format: formatCurrency } = useCurrency();
  // queryClient: permite invalidar consultas del caché para refrescar datos tras una venta.
  const queryClient = useQueryClient();

  // step: controla qué pantalla del POS se muestra.
  // Valor inicial: 'start' (pantalla de inicio con lista de citas/apartados).
  const [step, setStep] = useState<Step>('start');
  // Cuando el cajero añade un servicio desde el detalle del pedido (cobro de
  // una cita), volvemos directo al detalle en vez de pasar por productos.
  const [returnToDetails, setReturnToDetails] = useState(false);

  // items: carrito de venta — array de servicios y productos seleccionados.
  const [items, setItems] = useState<CartItem[]>([]);

  // search: texto del campo de búsqueda para filtrar servicios/productos.
  const [search, setSearch] = useState('');

  // discount: valor del descuento. Puede ser un número fijo ('10') o porcentaje ('15').
  const [discount, setDiscount] = useState('0');

  // discountType: 'amount' = descuento en dinero fijo, 'percent' = porcentaje del subtotal.
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');

  // tipPercent: porcentaje de propina seleccionado de un botón rápido (10%, 15%, 20%).
  // null = no hay propina por porcentaje (se usa tipManual si lo hay).
  const [tipPercent, setTipPercent] = useState<number | null>(null);

  // tipManual: propina ingresada manualmente por el cajero (campo de texto libre).
  const [tipManual, setTipManual] = useState('');

  // paymentMethod: método de pago seleccionado. 'CASH' por defecto.
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');

  // cashGiven: efectivo que entregó el cliente (para calcular el cambio).
  const [cashGiven, setCashGiven] = useState('');

  // phone: teléfono del cliente para enviar el recibo por WhatsApp.
  const [phone, setPhone] = useState('');

  // error: mensaje de error a mostrar al usuario (null si no hay error).
  const [error, setError] = useState<string | null>(null);

  // employeePickerFor: id del ítem de servicio que espera que se le asigne un empleado.
  // Al agregar un servicio al carrito, se abre el picker de empleados automáticamente.
  // null = el picker está cerrado.
  const [employeePickerFor, setEmployeePickerFor] = useState<string | null>(null);

  // selectedClientId: id del cliente seleccionado para facturar la venta.
  const [selectedClientId, setSelectedClientId] = useState('');

  // selectedLocationId: id de la ubicación/sucursal donde se realiza la venta.
  const [selectedLocationId, setSelectedLocationId] = useState('');

  // showNewClient: controla si el formulario de "Nuevo cliente" está visible.
  const [showNewClient, setShowNewClient] = useState(false);

  // newClient: campos del formulario de nuevo cliente (nombre, apellido, email, teléfono).
  const [newClient, setNewClient] = useState({ firstName: '', lastName: '', email: '', phone: '' });

  // selectedAppointmentId: id de la cita seleccionada para cobrar.
  // Valor inicial: initialAppointmentId si el padre lo pasó, o null.
  // || null: convierte undefined a null.
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(initialAppointmentId || null);
  // Apartado standalone (sin cita o con cita cancelada). Mutuamente
  // excluyente con selectedAppointmentId.
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(initialReservationId || null);

  // startTab: pestaña activa en la pantalla de inicio (citas o apartados cobrables).
  // Si se inicia con un apartado, la pestaña 'apartados' es la activa por defecto.
  // Pestaña activa del step start: Citas o Apartados.
  const [startTab, setStartTab] = useState<'citas' | 'apartados'>(initialReservationId ? 'apartados' : 'citas');
  // Cupón/descuento heredado de la cita pre-cargada. Se muestra como badge
  // encima del campo discount para que el cajero sepa de dónde viene el
  // descuento precargado y pueda removerlo o sumar más manualmente.
  const [appointmentCoupon, setAppointmentCoupon] = useState<{ amount: number; label: string; code: string | null } | null>(null);
  // loadedAppointmentRef: ref para controlar si la cita ya fue pre-cargada.
  // Evita que refetches del query "pos-appointments" sobrescriban lo que el
  // cajero acabe de editar. useRef no dispara re-renders al cambiar.
  // Marca que appointment ya pre-cargamos (cliente, items, phone). Evita
  // que refetches del query "pos-appointments" sobrescriban lo que el
  // cajero acabe de editar.
  const loadedAppointmentRef = useRef<string | null>(null);

  // productDetail: datos del producto cuyo modal de detalle está abierto (null = cerrado).
  const [productDetail, setProductDetail] = useState<any | null>(null);

  // transferProofFile: archivo de imagen del comprobante de transferencia.
  const [transferProofFile, setTransferProofFile] = useState<File | null>(null);

  // transferProofPreview: URL data: de la previsualización del comprobante (base64).
  const [transferProofPreview, setTransferProofPreview] = useState<string | null>(null);

  // pendingPaymentId: id de la cita asociada al pago recién procesado.
  // Se usa para subir el comprobante de transferencia y para el QR de reseña.
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  // Tras cobrar una cita, generamos el token de reseña para que el cliente
  // escanee el QR aquí mismo en recepción. Si no puede/no quiere, el cajero
  // pulsa "Saltar reseña" y el cliente la dejará luego desde su app.
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null);

  // reviewSkipped: true si el cajero pulsó "Saltar reseña" en el comprobante.
  const [reviewSkipped, setReviewSkipped] = useState(false);
  // Modal "¿Agendar nueva cita?" al cerrar la venta. Solo aparece si la
  // venta tuvo cliente conocido (cita pre-cargada o cliente seleccionado).
  const [showRebook, setShowRebook] = useState(false);

  // ── Consultas al backend (useQuery) ──────────────────────────────────────
  // today: fecha de hoy en formato 'YYYY-MM-DD' para el filtro de citas.
  // .toISOString().split('T')[0]: extrae solo la fecha de un ISO completo.
  // Queries
  // Citas desde hoy y hasta los próximos 30 días — el cajero puede adelantar
  // pagos de citas futuras (por ej. el cliente llegó antes o quiere prepagar).
  const today = new Date().toISOString().split('T')[0];

  // horizon: fecha de hoy + 30 días.
  // d.setDate(d.getDate() + 30): modifica el día del mes sumando 30 días.
  // La IIFE (() => { ... })() permite usar variables locales sin declarar const extra.
  const horizon = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  })();

  // Citas próximas (hoy → +30 días): para que el cajero vea las citas de la semana.
  const { data: appointmentsData } = useQuery({
    queryKey: ['pos-appointments', today, horizon],
    queryFn: () => api.get<{ data: any[] }>(`/api/appointments?startDate=${today}&endDate=${horizon}&perPage=100`),
  });
  // Citas "Por cobrar" de CUALQUIER día — el wizard del empleado puede
  // delegar al POS una cita de mañana o pasado mañana; el cajero las
  // debe ver aunque no sean de hoy.
  const { data: pendingPosData } = useQuery({
    queryKey: ['pos-pending-pos'],
    queryFn: () => api.get<{ data: any[] }>(`/api/appointments?pendingPosPayment=true&perPage=50`),
  });
  // Apartados cobrables (sin cita o con cita cancelada). El backend ya
  // filtra los que pertenecen a citas activas para evitar doble cobro.
  const { data: payableReservationsData } = useQuery({
    queryKey: ['pos-payable-reservations'],
    queryFn: () => api.get<{ data: any[] }>(`/api/products/reservations/payable`),
  });
  // payableReservations: extrae el array del wrapper de respuesta (?.data || []).
  const payableReservations = payableReservationsData?.data || [];

  // Listas de catálogo para los steps de selección.
  const { data: servicesData } = useQuery({ queryKey: ['pos-services'], queryFn: () => api.get<{ data: any[] }>('/api/services?perPage=100') });
  const { data: productsData } = useQuery({ queryKey: ['pos-products'], queryFn: () => api.get<{ data: any[] }>('/api/products?perPage=100') });
  const { data: employeesData } = useQuery({ queryKey: ['pos-employees'], queryFn: () => api.get<{ data: any[] }>('/api/employees?perPage=100') });
  const { data: locationsData } = useQuery({ queryKey: ['pos-locations'], queryFn: () => api.get<{ data: any[] }>('/api/locations') });
  const { data: clientsData } = useQuery({ queryKey: ['pos-clients'], queryFn: () => api.get<{ data: any[] }>('/api/clients?perPage=100') });
  // tenantData: datos del negocio, incluyendo posWhatsappNumber para envío de recibos.
  const { data: tenantData } = useQuery({ queryKey: ['tenant-current'], queryFn: () => api.get<{ data: any }>('/api/tenants/current') });

  // appointments: array combinado y deduplicado de citas próximas + pendientes de pago.
  // Mergeamos:
  //  - Citas próximas (hoy → +30 días)
  //  - Citas pending POS de cualquier día (puede ser de ayer si el empleado
  //    delegó el cobro y el cliente vuelve hoy)
  // Dedup por id. Las pending POS siempre arriba, después por startTime asc
  // (la más próxima primero).
  // Algoritmo:
  // 1. Filtramos citas próximas por estados activos (no CANCELLED, no COMPLETED).
  // 2. Usamos un Map<id, cita> para deduplicar (si una cita está en ambas listas, gana la última).
  // 3. Array.from(byId.values()): convierte el Map de vuelta a un array.
  // 4. .sort(): ordena poniendo las "pendingPosPayment" primero; luego cronológicamente.
  //    -1: a va antes que b. 1: b va antes que a. 0: iguales (mantiene orden).
  //    new Date(x).getTime(): convierte fecha ISO a milisegundos (comparable numéricamente).
  const appointments = (() => {
    const upcoming = (appointmentsData?.data || []).filter((a: any) =>
      ['CONFIRMED', 'PENDING', 'IN_PROGRESS', 'RESCHEDULED'].includes(a.status),
    );
    const pending = pendingPosData?.data || [];
    const byId = new Map<string, any>();
    for (const a of upcoming) byId.set(a.id, a);
    for (const a of pending) byId.set(a.id, a);
    return Array.from(byId.values()).sort((a: any, b: any) => {
      if (a.pendingPosPayment && !b.pendingPosPayment) return -1;
      if (!a.pendingPosPayment && b.pendingPosPayment) return 1;
      // Orden cronológico: la más próxima arriba.
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
  })();

  // Listas filtradas del catálogo. || []: fallback si aún carga.
  const services = servicesData?.data || [];
  // Productos: solo los activos, listados en tienda y con stock disponible.
  const products = (productsData?.data || []).filter((p: any) => p.isActive && p.isShopListed && p.stock > 0);
  // Empleados: solo los activos (pueden atender clientes).
  const employees = (employeesData?.data || []).filter((e: any) => e.isActive);
  const locations = locationsData?.data || [];
  const clients = clientsData?.data || [];
  // posWhatsapp: número de WhatsApp para enviar recibos (puede ser vacío).
  const posWhatsapp = tenantData?.data?.posWhatsappNumber || '';

  // Pre-load from appointment — solo UNA vez por appointmentId, no en cada
  // refetch del query. Si no protegemos con el ref, cualquier edición del
  // cajero (teléfono, items, etc.) se borra al siguiente refetch.
  useEffect(() => {
    if (!selectedAppointmentId) {
      loadedAppointmentRef.current = null;
      return;
    }
    if (loadedAppointmentRef.current === selectedAppointmentId) return;
    const apt = appointments.find((a: any) => a.id === selectedAppointmentId);
    if (!apt) return;
    loadedAppointmentRef.current = selectedAppointmentId;
    if (apt.client) {
      setSelectedClientId(apt.clientId);
      const cleaned = String(apt.client.phone || '').replace(/\D/g, '').slice(-10);
      setPhone(cleaned);
    }
    if (apt.locationId) setSelectedLocationId(apt.locationId);
    // Items del cart = servicios de la cita + productos reservados pendientes.
    // Si el cliente agregó productos al booking (carrito de tienda en la
    // reserva), van en apt.productReservations. Solo cargamos los que aún
    // no están cobrados/entregados — DELIVERED y CANCELLED se omiten.
    const cartItems: CartItem[] = [];
    if (apt.items?.length) {
      cartItems.push(...apt.items.map((item: any) => ({
        id: `svc-${item.serviceId || item.id}`,
        name: item.serviceNameSnapshot,
        price: Number(item.priceSnapshot),
        quantity: 1,
        type: 'service' as const,
        employeeId: item.employeeId || apt.employeeId,
        employeeName: apt.employee ? `${apt.employee.firstName} ${apt.employee.lastName}` : undefined,
        duration: item.durationSnapshot,
      })));
    }
    if (apt.productReservations?.length) {
      cartItems.push(
        ...apt.productReservations
          .filter((r: any) => ['PENDING', 'CONFIRMED', 'READY'].includes(r.status))
          .map((r: any) => ({
            id: `prod-${r.productId}`,
            name: r.product?.name || 'Producto',
            price: Number(r.unitPrice),
            quantity: Number(r.quantity) || 1,
            type: 'product' as const,
            imageUrl: r.product?.imageUrl,
          })),
      );
    }
    if (cartItems.length > 0) {
      setItems(cartItems);
    }
    // Cupón/descuento aplicado a la cita: lo precargamos en el campo
    // discount para que el cobro respete lo que el cliente ya consiguió.
    // El cajero sigue pudiendo sumar descuento manual encima editando el
    // input. El badge informa qué cupón viene.
    if (apt.discountAmount && Number(apt.discountAmount) > 0) {
      setDiscount(String(Number(apt.discountAmount)));
      setDiscountType('amount');
      setAppointmentCoupon({
        amount: Number(apt.discountAmount),
        label: apt.redemption?.reward?.name
          || (apt.notes?.match(/\[Cup[oó]n: ([^\]]+)\]/)?.[1])
          || (apt.notes?.match(/\[Promoci[oó]n: ([^\]]+)\]/)?.[1])
          || 'Cupón',
        code: apt.redemption?.code || null,
      });
    } else {
      setAppointmentCoupon(null);
    }
    setStep('details');
  }, [selectedAppointmentId, appointments]);

  // Pre-load desde un apartado standalone. Mismo patron que el de
  // appointments pero la fuente es el reservation y NO hay items de
  // servicio — solo el producto del apartado. El cliente puede no estar
  // en la BD (apartado anonimo); usamos los datos snapshot.
  const loadedReservationRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedReservationId) {
      loadedReservationRef.current = null;
      return;
    }
    if (loadedReservationRef.current === selectedReservationId) return;
    const r = payableReservations.find((x: any) => x.id === selectedReservationId);
    if (!r) return;
    loadedReservationRef.current = selectedReservationId;
    setItems([
      {
        id: `prod-${r.productId}`,
        name: r.product?.name || 'Producto',
        price: Number(r.unitPrice),
        quantity: Number(r.quantity) || 1,
        type: 'product' as const,
        imageUrl: r.product?.imageUrl,
      },
    ]);
    setPhone(String(r.customerPhone || '').replace(/\D/g, '').slice(-10));
    setAppointmentCoupon(null);
    setDiscount('0');
    setStep('details');
  }, [selectedReservationId, payableReservations]);

  const filteredServices = search ? services.filter((s: any) => s.name.toLowerCase().includes(search.toLowerCase())) : services;
  const filteredProducts = search ? products.filter((p: any) => p.name.toLowerCase().includes(search.toLowerCase())) : products;

  // ── Funciones del carrito ─────────────────────────────────────────────────

  // addToCart: agrega un ítem al carrito o incrementa su cantidad si ya existe.
  // Si el ítem ya está (existing !== undefined): incrementa quantity en 1.
  //   { ...i, quantity: i.quantity + 1 }: spread del ítem existente + quantity actualizado.
  // Si es nuevo: agrega un CartItem con quantity: 1.
  //   [...prev, { ... }]: spread del array anterior + el nuevo elemento al final.
  // Para servicios: abre el selector de empleado automáticamente (UX: el cajero asigna inmediatamente).
  // Cart
  function addToCart(id: string, name: string, price: number, type: 'service' | 'product', imageUrl?: string, duration?: number) {
    const existing = items.find((i) => i.id === id);
    if (existing) {
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setItems((prev) => [...prev, { id, name, price, quantity: 1, type, imageUrl, duration }]);
      if (type === 'service') setEmployeePickerFor(id);
    }
  }

  // updateQuantity: actualiza la cantidad de un ítem o lo elimina si qty <= 0.
  // .filter(): devuelve un nuevo array sin el ítem (equivale a eliminarlo).
  // .map() con { ...i, quantity: qty }: actualiza solo el ítem que coincide.
  function updateQuantity(id: string, qty: number) {
    if (qty <= 0) setItems((prev) => prev.filter((i) => i.id !== id));
    else setItems((prev) => prev.map((i) => i.id === id ? { ...i, quantity: qty } : i));
  }

  // assignEmployee: asigna un empleado a un ítem de servicio del carrito.
  // { ...i, employeeId: empId, employeeName: empName }: spread + dos campos nuevos.
  // setEmployeePickerFor(null): cierra el selector de empleados.
  function assignEmployee(itemId: string, empId: string, empName: string) {
    setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, employeeId: empId, employeeName: empName } : i));
    setEmployeePickerFor(null);
  }

  // getCartQty: devuelve la cantidad de un ítem en el carrito (0 si no está).
  // ?.quantity: acceso seguro si el ítem no existe. || 0: fallback si es undefined.
  function getCartQty(id: string) { return items.find((i) => i.id === id)?.quantity || 0; }

  // ── Cálculos financieros del carrito ──────────────────────────────────────
  // serviceItems: solo los ítems del carrito que son servicios (type='service').
  const serviceItems = items.filter((i) => i.type === 'service');
  // productItems: solo los ítems del carrito que son productos (type='product').
  const productItems = items.filter((i) => i.type === 'product');

  // subtotal: suma de (precio × cantidad) de TODOS los ítems del carrito.
  // .reduce(acumulador, ítem): reduce el array a un único valor.
  // s = acumulador (suma parcial), i = ítem actual.
  // i.price * i.quantity: precio unitario × número de unidades.
  // , 0: valor inicial del acumulador (sin esto puede dar NaN si el carrito está vacío).
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

  // totalItems: suma de cantidades de todos los ítems (para mostrar "N artículos").
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  // discountAmount: monto del descuento en dinero.
  // Si discountType = 'percent': se calcula como porcentaje del subtotal.
  //   Ejemplo: subtotal=1000, discount='15' → discountAmount = 1000 * 0.15 = 150
  //   parseFloat(discount): convierte el string '15' a número 15.
  //   || 0: si discount es '' o 'abc' (inválido), parseFloat devuelve NaN; || 0 lo reemplaza por 0.
  //   / 100: convierte el porcentaje a decimal (15% → 0.15).
  // Si discountType = 'amount': el descuento es un monto fijo.
  //   Ejemplo: discount='50' → discountAmount = 50 (sin importar el subtotal).
  const discountAmount = discountType === 'percent' ? subtotal * ((parseFloat(discount) || 0) / 100) : (parseFloat(discount) || 0);

  // tipAmount: monto de la propina en dinero.
  // Si tipPercent != null (botón rápido 10/15/20% pulsado):
  //   tipAmount = subtotal × (tipPercent / 100)
  //   Ejemplo: subtotal=1000, tipPercent=15 → tipAmount = 150
  //   != null: tanto null como undefined se excluyen (tipPercent podría ser 0 válido).
  // Si tipPercent es null (propina manual):
  //   tipAmount = parseFloat(tipManual) || 0
  //   Ejemplo: tipManual='30' → tipAmount = 30
  const tipAmount = tipPercent != null ? subtotal * (tipPercent / 100) : (parseFloat(tipManual) || 0);

  // total: monto final a cobrar al cliente.
  // Fórmula: (subtotal − descuento) + propina
  // Math.max(0, subtotal - discountAmount): garantiza que el total no sea negativo
  //   (si el descuento supera el subtotal, el resultado sería 0, no un número negativo).
  // + tipAmount: la propina se suma DESPUÉS de aplicar el descuento.
  // Ejemplo completo:
  //   subtotal=1000, descuento=150, propina=150
  //   total = Math.max(0, 1000-150) + 150 = 850 + 150 = 1000
  const total = Math.max(0, subtotal - discountAmount) + tipAmount;

  // cashChange: cambio/vuelto a devolver al cliente cuando paga en efectivo.
  // cashGiven: dinero que entregó el cliente (string del input → parseFloat → número).
  // Math.max(0, ...): evita cambio negativo si el cliente entregó menos de lo que debe.
  // Ejemplo: total=850, cashGiven='1000' → cashChange = Math.max(0, 1000-850) = 150
  const cashChange = Math.max(0, (parseFloat(cashGiven) || 0) - total);

  // ── Mutación: crear cliente nuevo ─────────────────────────────────────────
  // createClientMutation: crea un cliente y lo selecciona automáticamente.
  // onSuccess: al crear exitosamente →
  //   1. Invalida el caché de clientes (para que la lista se actualice con el nuevo).
  //   2. Selecciona el nuevo cliente automáticamente (usando su id devuelto).
  //   3. Cierra el formulario de nuevo cliente.
  //   4. Limpia los campos del formulario.
  // Create client
  const createClientMutation = useMutation({
    mutationFn: (data: any) => api.post<{ data: any }>('/api/clients', data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['pos-clients'] });
      setSelectedClientId(res.data.id);
      setShowNewClient(false);
      setNewClient({ firstName: '', lastName: '', email: '', phone: '' });
    },
  });

  // ── Mutación principal: procesar pago ────────────────────────────────────
  // processPayment: registra el pago en el backend y, si hay servicios sin cita,
  // crea una cita "desde POS" para trazabilidad.
  // Process payment
  const processPayment = useMutation({
    // mutationFn: función async que realiza los pasos del cobro.
    // Retorna { appointmentId } para que onSuccess sepa si hay cita asociada.
    mutationFn: async (payload: any): Promise<{ appointmentId: string | null }> => {
      // 1. Registrar el pago en la BD (siempre, independientemente de si hay cita).
      const payRes = await api.post<{ data: any }>('/api/payments', payload);
      let appointmentId: string | null = selectedAppointmentId;
      // 2. Si es venta libre (sin cita) con servicios: crear cita from-pos para
      //    mantener el historial del empleado y las comisiones.
      // serviceItems.length > 0: solo si hay servicios (no solo productos).
      // Create appointment from POS if no existing appointment
      if (!selectedAppointmentId && serviceItems.length > 0) {
        const aptRes = await api.post<{ data: any }>('/api/appointments/from-pos', {
          clientId: payload.clientId,
          locationId: payload.locationId,
          // .map().filter(): genera la lista de asignaciones servicio→empleado,
          // filtrando los que no tienen empleado asignado aún.
          serviceAssignments: serviceItems.map((i) => ({
            serviceId: i.id.replace('svc-', ''),  // Quita el prefijo 'svc-'
            employeeId: i.employeeId,
          })).filter((a) => a.employeeId),
          notes: 'Venta desde POS',
        });
        appointmentId = aptRes?.data?.id || null;
      }
      return { appointmentId };
    },
    // Tras cobrar exitosamente NO cerramos el flujo: vamos al paso de
    // comprobante para que el cajero pueda mandar el recibo por WhatsApp.
    // El cierre real (onComplete) se dispara solo cuando hace "Nueva venta".
    onSuccess: ({ appointmentId }) => {
      // Guardamos el appointmentId para el comprobante y la subida del comprobante.
      setPendingPaymentId(appointmentId);
      // Invalida historial y citas del POS para que al cambiar de tab la
      // venta recién registrada aparezca al instante (sin esto el cache
      // de React Query devuelve los datos viejos).
      queryClient.invalidateQueries({ queryKey: ['pos-history'] });
      queryClient.invalidateQueries({ queryKey: ['pos-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['pos-pending-pos'] });
      // Si hay cita asociada: generar token de reseña → QR para que el cliente escanee.
      // Si hay cita asociada (sea pendingPosPayment o cobro estándar de
      // cita), generamos el token de reseña para mostrar el QR aquí.
      if (appointmentId) {
        api.post<{ data: { token: string; alreadyConfirmed: boolean } }>(
          `/api/appointments/${appointmentId}/generate-confirmation-token`,
          {},
        )
          .then((res) => setConfirmationToken(res.data.token))
          .catch(() => { /* silencioso — el receipt sigue funcionando sin QR */ });
      }
      // Navegar al paso de comprobante.
      setStep('receipt');
    },
    // onError: si falla el cobro, mostrar el mensaje de error del backend.
    onError: (err: any) => setError(err.message || 'Error al procesar el pago'),
  });

  // ── Mutación: subir comprobante de transferencia ─────────────────────────
  // uploadProofMutation: sube la foto/captura del comprobante bancario.
  // Se ejecuta después del cobro si el método de pago es TRANSFER.
  // pendingPaymentId: el id de la cita creada/usada en el cobro.
  // Upload de comprobante (transferencia) — adjunta la captura al
  // appointmentId creado tras cobrar.
  const uploadProofMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!pendingPaymentId) throw new Error('No hay cita asociada al pago');
      return api.upload<{ data: { paymentProofUrl: string } }>(
        `/api/appointments/${pendingPaymentId}/payment-proof`,
        file,
      );
    },
  });

  // resetCheckout: limpia TODOS los estados del POS para iniciar una venta nueva.
  // Llamado desde el botón "Nueva venta" en el paso de comprobante.
  // Resetea todo el estado a una venta nueva — lo usa el botón "Nueva venta"
  // del paso de comprobante.
  function resetCheckout() {
    setItems([]);
    setSearch('');
    setDiscount('0');
    setDiscountType('amount');
    setTipPercent(null);
    setTipManual('');
    setPaymentMethod('CASH');
    setCashGiven('');
    setPhone('');
    setError(null);
    setSelectedClientId('');
    setSelectedLocationId('');
    setSelectedAppointmentId(null);
    setPendingPaymentId(null);
    setTransferProofFile(null);
    setTransferProofPreview(null);
    setProductDetail(null);
    setConfirmationToken(null);
    setReviewSkipped(false);
    setAppointmentCoupon(null);
    setStep('start');
  }

  // handlePay: valida el formulario y lanza el procesamiento del pago.
  // Validaciones (early return con setError si alguna falla):
  // 1. Cliente seleccionado (requerido para facturación).
  // 2. Ubicación seleccionada (requerido para trazabilidad).
  // 3. Todos los servicios tienen empleado asignado.
  // Si todo es válido: llama a processPayment.mutate() con el payload completo.
  function handlePay() {
    if (!selectedClientId) { setError('Selecciona un cliente'); return; }
    if (!selectedLocationId) { setError('Selecciona una ubicación'); return; }
    // serviceItems.filter(): busca servicios sin empleado asignado.
    const unassigned = serviceItems.filter((i) => !i.employeeId);
    if (unassigned.length > 0) { setError(`Asigna un empleado a: ${unassigned.map((i) => i.name).join(', ')}`); return; }
    setError(null);

    // processPayment.mutate(): ejecuta la mutación con el payload.
    // items.map(): transforma cada CartItem al formato que espera el backend.
    // ...(condición && { campo }): spread condicional — solo añade el campo si la condición es true.
    //   Ejemplo: si el id comienza con 'svc-', añade referenceId y referenceType: 'service'.
    // i.id.replace('svc-', ''): elimina el prefijo para obtener el UUID real del servicio.
    // discountAmount || 0: si discountAmount es 0 o NaN, envía 0 en lugar de undefined.
    processPayment.mutate({
      appointmentId: selectedAppointmentId || undefined,
      productReservationId: selectedReservationId || undefined,
      clientId: selectedClientId,
      locationId: selectedLocationId,
      items: items.map((i) => ({
        description: i.name, quantity: i.quantity, unitPrice: i.price,
        itemType: i.type === 'service' ? 'SERVICE' : 'PRODUCT',
        ...(i.id.startsWith('svc-') && { referenceId: i.id.replace('svc-', ''), referenceType: 'service' }),
        ...(i.id.startsWith('prod-') && { referenceId: i.id.replace('prod-', ''), referenceType: 'product' }),
      })),
      paymentMethod,
      discountAmount: discountAmount || 0,
      tipAmount: tipAmount || 0,
      taxAmount: 0,
      // notes: solo si hay teléfono, adjunta el número para el recibo.
      notes: phone ? `Recibo al: ${phone}` : undefined,
    });
  }

  // ── Helpers de renderizado ────────────────────────────────────────────────

  // renderStepProgress: barra de progreso visual de los 4 pasos del POS.
  // Muestra círculos numerados (1→4) con checkmarks para los pasos completados.
  // active: el paso actual del flujo.
  // Progress bar — mismo patrón visual que el flujo de reserva del cliente
  function renderStepProgress(active: 'services' | 'products' | 'details' | 'pay') {
    const steps: { key: 'services' | 'products' | 'details' | 'pay'; label: string }[] = [
      { key: 'services', label: 'Servicios' },
      { key: 'products', label: 'Productos' },
      { key: 'details', label: 'Detalles' },
      { key: 'pay', label: 'Pago' },
    ];
    // currentIdx: índice del paso activo dentro del array steps.
    // .findIndex(): devuelve el índice del primer elemento que cumple la condición, o -1.
    const currentIdx = steps.findIndex((s) => s.key === active);
    return (
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          {steps.map(({ key, label }, idx) => {
            // isDone: este paso ya fue completado (el índice actual es mayor).
            // isCurrent: este es el paso activo ahora mismo.
            // Estados visuales — usan vars CSS para los pasos NO completados
            // de modo que el modo oscuro los respete. El paso completado se
            // mantiene en teal sólido (color de marca).
            const isDone = currentIdx > idx;
            const isCurrent = currentIdx === idx;
            // circleStyle: estilo en línea del círculo según el estado del paso.
            // React.CSSProperties: tipo TypeScript para estilos CSS en línea (objetos JS).
            const circleStyle: React.CSSProperties = isDone
              ? { backgroundColor: '#008080', color: '#fff' }        // Completado: teal sólido
              : isCurrent
                ? { backgroundColor: 'var(--primary-tint)', color: '#008080', border: '2px solid #008080' } // Activo: contorno teal
                : { backgroundColor: 'var(--bg-muted)', color: 'var(--text-tertiary)' }; // Futuro: gris
            const labelColor = isCurrent ? '#008080' : 'var(--text-tertiary)';
            const connectorBg = isDone ? '#008080' : 'var(--border)';
            return (
              <div key={key} className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-1.5">
                  {/* Círculo: muestra '✓' si completado, número si no. */}
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0" style={circleStyle}>
                    {isDone ? '✓' : idx + 1}
                  </div>
                  {/* Etiqueta: solo en pantallas sm y mayores (hidden sm:block). */}
                  <span
                    className="text-xs hidden sm:block"
                    style={{ color: labelColor, fontWeight: isCurrent ? 500 : 400 }}
                  >
                    {label}
                  </span>
                </div>
                {/* Línea conectora entre pasos. No se dibuja después del último. */}
                {idx < steps.length - 1 && (
                  <div className="flex-1 h-0.5" style={{ backgroundColor: connectorBg }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // renderSearchRow: campo de búsqueda reutilizable para filtrar servicios/productos.
  // placeholder: texto de ayuda que varía según el paso ('Buscar servicio...' vs 'Buscar producto...').
  // Buscador en su propio renglón (debajo del header con el progreso de pasos)
  function renderSearchRow(placeholder: string) {
    return (
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-2xl mx-auto relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={placeholder}
            className="text-sm border border-gray-200 rounded-full pl-9 pr-3 py-2 w-full focus:border-[#008080] focus:ring-1 focus:ring-[#008080] bg-white"
          />
        </div>
      </div>
    );
  }

  // Shared components
  function renderCard(id: string, name: string, price: number, type: 'service' | 'product', imageUrl?: string, duration?: number, fullData?: any) {
    const qty = getCartQty(id);
    const cartItem = items.find((i) => i.id === id);
    const assignedEmp = cartItem?.employeeId ? employees.find((e: any) => e.id === cartItem.employeeId) : null;

    // ─── PRODUCTOS ─────────────────────────────────────
    // Mantienen la card original con imagen. Click en imagen abre detalle.
    if (type === 'product') {
      return (
        <div key={id} className={`relative bg-white rounded-xl border-2 overflow-hidden transition-all hover:shadow-md ${qty > 0 ? 'border-[#008080]' : 'border-gray-200 hover:border-gray-300'}`}>
          {/* Imagen: click separado para abrir detalle */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setProductDetail(fullData || { id: id.replace('prod-', ''), name, price, imageUrl }); }}
            className="block w-full aspect-[5/3] bg-gray-100 flex items-center justify-center overflow-hidden hover:opacity-90 transition-opacity"
            aria-label="Ver detalle del producto"
          >
            {imageUrl ? <img src={`${API_URL}${imageUrl}`} alt="" className="w-full h-full object-cover" /> : (
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4" /></svg>
            )}
          </button>
          {/* Texto + precio + add */}
          <button
            type="button"
            onClick={() => { if (qty === 0) addToCart(id, name, price, type, imageUrl, duration); }}
            className="w-full text-left p-3"
          >
            <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
            <p className="text-sm font-bold text-[#008080] mt-0.5">{formatCurrency(price)}</p>
          </button>
          {qty > 0 && (
            <div className="absolute bottom-2 right-2 flex items-center gap-0.5 bg-[#008080] rounded-full shadow px-1 py-0.5">
              <button onClick={(e) => { e.stopPropagation(); updateQuantity(id, qty - 1); }} className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold hover:bg-[#006666]">−</button>
              <span className="text-[11px] font-bold text-white w-4 text-center">{qty}</span>
              <button onClick={(e) => { e.stopPropagation(); updateQuantity(id, qty + 1); }} className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold hover:bg-[#006666]">+</button>
            </div>
          )}
        </div>
      );
    }

    // ─── SERVICIOS ─────────────────────────────────────
    // Card más alta con cápsula de empleado prominente arriba (cuando se
    // agrega al carrito). Sin imagen, todo el espacio para servicio + emp.
    return (
      <div key={id} className={`relative bg-white rounded-xl border-2 overflow-hidden transition-all hover:shadow-md flex flex-col ${qty > 0 ? 'border-[#008080]' : 'border-gray-200 hover:border-gray-300'}`} style={{ minHeight: 140 }}>
        {/* Zona empleado — siempre reservada para servicios con qty > 0 */}
        {qty > 0 ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setEmployeePickerFor(id); }}
            className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100 hover:bg-gray-100 transition-colors text-left"
          >
            {assignedEmp ? (
              <>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: assignedEmp.color || '#008080' }}>
                  {assignedEmp.avatarUrl ? <img src={`${API_URL}${assignedEmp.avatarUrl}`} alt="" className="w-full h-full object-cover" /> : assignedEmp.firstName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-400 leading-none">Atiende</p>
                  <p className="text-xs font-semibold text-gray-900 truncate leading-tight mt-0.5">{assignedEmp.firstName} {assignedEmp.lastName}</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-7 h-7 rounded-full bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <p className="text-xs font-medium text-red-600 flex-1">Asignar empleado</p>
              </>
            )}
          </button>
        ) : null}

        {/* Cuerpo del servicio: nombre + precio */}
        <button
          type="button"
          onClick={() => { if (qty === 0) addToCart(id, name, price, type, imageUrl, duration); }}
          className="w-full flex-1 text-left p-4 flex flex-col justify-center"
        >
          <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">{name}</p>
          {duration && (
            <p className="text-[10px] text-gray-400 mt-1">{duration} min</p>
          )}
          <p className="text-base font-bold text-[#008080] mt-1.5">{formatCurrency(price)}</p>
        </button>

        {qty > 0 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-0.5 bg-[#008080] rounded-full shadow px-1 py-0.5">
            <button onClick={(e) => { e.stopPropagation(); updateQuantity(id, qty - 1); }} className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold hover:bg-[#006666]">−</button>
            <span className="text-[11px] font-bold text-white w-4 text-center">{qty}</span>
            <button onClick={(e) => { e.stopPropagation(); updateQuantity(id, qty + 1); }} className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold hover:bg-[#006666]">+</button>
          </div>
        )}
      </div>
    );
  }

  function renderProductDetail() {
    if (!productDetail) return null;
    const p = productDetail;
    const cartId = `prod-${p.id}`;
    const qty = getCartQty(cartId);
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center" onClick={() => setProductDetail(null)}>
        <div
          className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl overflow-hidden max-h-[90vh] flex flex-col border-2"
          style={{ borderColor: '#008080' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Imagen grande */}
          <div className="relative aspect-[5/3] bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
            {p.imageUrl ? (
              <img src={`${API_URL}${p.imageUrl}`} alt={p.name} className="w-full h-full object-cover" />
            ) : (
              <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4" />
              </svg>
            )}
            <button
              onClick={() => setProductDetail(null)}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-lg ring-1 ring-black/5 hover:scale-105 transition-transform"
              style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }}
              aria-label="Cerrar"
            >
              <svg className="w-5 h-5" style={{ color: '#008080' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Contenido scroleable */}
          <div className="flex-1 overflow-y-auto p-5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-900">{p.name}</h3>
                {p.category && <p className="text-xs text-gray-400 mt-0.5">{p.category}</p>}
              </div>
              <p className="text-xl font-bold text-[#008080] whitespace-nowrap">{formatCurrency(Number(p.price))}</p>
            </div>

            {p.description && (
              <div className="mb-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Descripción</p>
                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{p.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              {typeof p.stock === 'number' && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Stock</p>
                  <p className="font-medium text-gray-900">{p.stock} disponibles</p>
                </div>
              )}
              {p.sku && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">SKU</p>
                  <p className="font-mono text-xs text-gray-900">{p.sku}</p>
                </div>
              )}
              {p.brand && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Marca</p>
                  <p className="font-medium text-gray-900">{p.brand}</p>
                </div>
              )}
              {p.unit && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Unidad</p>
                  <p className="font-medium text-gray-900">{p.unit}</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer con add/quantity */}
          <div className="border-t border-gray-100 bg-white p-4">
            {qty === 0 ? (
              <button
                onClick={() => {
                  addToCart(cartId, p.name, Number(p.price), 'product', p.imageUrl, p.durationMinutes);
                  setProductDetail(null);
                }}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: '#008080' }}
              >
                Agregar al pedido
              </button>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQuantity(cartId, qty - 1)} className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 text-gray-700 text-lg">−</button>
                  <span className="text-base font-semibold w-8 text-center">{qty}</span>
                  <button onClick={() => updateQuantity(cartId, qty + 1)} className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 text-gray-700 text-lg">+</button>
                </div>
                <button
                  onClick={() => setProductDetail(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ backgroundColor: '#008080' }}
                >
                  Hecho
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderEmployeePicker() {
    if (!employeePickerFor) return null;
    return (
      <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => { setEmployeePickerFor(null); updateQuantity(employeePickerFor, 0); }}>
        <div
          className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 border-2"
          style={{ borderColor: '#008080' }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm font-semibold text-gray-900 mb-1">¿Quién atiende este servicio?</p>
          <p className="text-xs text-gray-400 mb-4">{items.find((i) => i.id === employeePickerFor)?.name}</p>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {employees.map((emp: any) => (
              <button key={emp.id} onClick={() => assignEmployee(employeePickerFor!, emp.id, `${emp.firstName} ${emp.lastName}`)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: emp.color || '#008080' }}>
                  {emp.avatarUrl ? <img src={`${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" /> : <>{emp.firstName[0]}{emp.lastName[0]}</>}
                </div>
                <span className="text-sm text-gray-700">{emp.firstName} {emp.lastName}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderBottomBar(nextStep: Step, label?: string) {
    if (totalItems === 0) return null;
    return (
      <div className="border-t border-gray-200 bg-white px-6 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">{totalItems} item{totalItems !== 1 ? 's' : ''}</p>
          <p className="text-xs text-gray-500">{formatCurrency(subtotal)}</p>
        </div>
        <button onClick={() => { setStep(nextStep); setSearch(''); }} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#008080' }}>
          {label || 'Siguiente'}
        </button>
      </div>
    );
  }

  function renderGridSection(title: string, grouped: Record<string, any[]>, type: 'service' | 'product') {
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b, 'es')).map(([cat, list]) => (
      <div key={cat} className="mb-4">
        <p className="text-xs font-bold text-gray-600 mb-2">{cat}</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {list.map((item: any) => renderCard(
            `${type === 'service' ? 'svc' : 'prod'}-${item.id}`,
            item.name, Number(item.price), type, item.imageUrl, item.durationMinutes, item,
          ))}
        </div>
      </div>
    ));
  }

  // ─── STEP 0: Start ───
  if (step === 'start') {
    return (
      <div className="flex flex-col h-full p-6">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 text-center mb-2">¿Cómo deseas iniciar?</h2>

            <button onClick={() => { setReturnToDetails(false); setStep('services'); }}
              className="w-full p-5 bg-white rounded-xl border-2 border-gray-200 hover:border-[#008080] hover:bg-teal-50 transition-all text-left">
              <p className="text-sm font-semibold text-gray-900">Venta directa</p>
              <p className="text-xs text-gray-500 mt-0.5">Sin cita previa — selecciona servicios y productos</p>
            </button>

            {/* Tabs: Citas / Apartados. Solo aparecen cuando hay items en
                alguna de las dos categorias para no contaminar la pantalla.
                Mismo ancho total que el boton "Venta directa" (w-full) y
                cada pestana ocupa la mitad (flex-1). */}
            {(appointments.length > 0 || payableReservations.length > 0) && (
              <div className="flex w-full bg-gray-100 border border-gray-200 rounded-lg p-0.5 mt-2">
                <button
                  type="button"
                  onClick={() => setStartTab('citas')}
                  className={`flex-1 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    startTab === 'citas'
                      ? 'bg-[#008080] text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Citas {appointments.length > 0 && <span className="ml-1 opacity-80">({appointments.length})</span>}
                </button>
                <button
                  type="button"
                  onClick={() => setStartTab('apartados')}
                  className={`flex-1 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    startTab === 'apartados'
                      ? 'bg-[#008080] text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Apartados {payableReservations.length > 0 && <span className="ml-1 opacity-80">({payableReservations.length})</span>}
                </button>
              </div>
            )}

            {startTab === 'citas' && appointments.length > 0 && (
              <>
                <p className="text-xs text-gray-400 text-center uppercase tracking-wider">selecciona una próxima cita</p>
                <div className="space-y-2 max-h-[28rem] overflow-y-auto">
                  {appointments.map((apt: any) => {
                    const services = apt.items?.map((i: any) => i.serviceNameSnapshot).join(', ') || '—';
                    const servicesPrice = (apt.items || []).reduce((s: number, i: any) => s + Number(i.priceSnapshot || 0), 0);
                    // Productos asociados a la cita (carrito del booking). El
                    // monto de la card debe reflejar lo que se cobrará en el
                    // POS, no solo el servicio — el cajero ve el total real.
                    const productsPrice = (apt.productReservations || [])
                      .filter((r: any) => r.status !== 'CANCELLED')
                      .reduce((s: number, r: any) => s + Number(r.unitPrice || 0) * Number(r.quantity || 1), 0);
                    // Descuento ya aplicado a la cita (cupón/puntos). Lo
                    // restamos del total mostrado para que coincida con lo
                    // que el cajero va a cobrar realmente.
                    const apptDiscount = Number(apt.discountAmount || 0);
                    const totalPrice = Math.max(0, servicesPrice + productsPrice - apptDiscount);
                    const empColor = apt.employee?.color || '#008080';
                    const day = formatBookingDay(apt.startTime);
                    const month = formatBookingMonthShort(apt.startTime);
                    const time = formatBookingTime(apt.startTime);
                    const endTime = apt.endTime ? formatBookingTime(apt.endTime) : null;
                    const statusInfo: Record<string, { text: string; bg: string; textColor: string; dot: string }> = {
                      CONFIRMED:   { text: 'Confirmada',     bg: 'bg-teal-50',   textColor: 'text-teal-700',   dot: '#008080' },
                      PENDING:     { text: 'Sin confirmar',  bg: 'bg-yellow-50', textColor: 'text-yellow-700', dot: '#eab308' },
                      IN_PROGRESS: { text: 'En curso',       bg: 'bg-purple-50', textColor: 'text-purple-700', dot: '#7c3aed' },
                    };
                    // pendingPosPayment gana al status — la cita ya fue
                    // finalizada por el empleado y solo falta el cobro.
                    const status = apt.pendingPosPayment
                      ? { text: 'Por cobrar', bg: 'bg-orange-50', textColor: 'text-orange-700', dot: '#f97316' }
                      : (statusInfo[apt.status] || { text: apt.status, bg: 'bg-gray-100', textColor: 'text-gray-600', dot: '#94a3b8' });

                    return (
                      <button
                        key={apt.id}
                        onClick={() => setSelectedAppointmentId(apt.id)}
                        className={`w-full bg-white rounded-2xl p-3 text-left hover:bg-gray-50 transition-colors ${
                          apt.pendingPosPayment
                            ? 'border-2 border-orange-300 ring-1 ring-orange-100'
                            : 'border border-gray-200'
                        }`}
                      >
                        <div className="grid items-center gap-x-3 gap-y-1.5" style={{ gridTemplateColumns: 'auto auto 1fr auto' }}>
                          {/* Col 1: fecha + hora */}
                          <div className="row-span-2 self-center text-center min-w-[44px]">
                            <p className="text-base font-bold leading-none tabular-nums" style={{ color: '#008080' }}>{day}</p>
                            <p className="text-[9px] font-semibold uppercase text-gray-400 mt-0.5">{month}</p>
                            <p className="text-xs font-semibold text-gray-700 tabular-nums mt-1.5 leading-none">{time}</p>
                            {endTime && (
                              <p className="text-[10px] text-gray-400 tabular-nums mt-0.5 leading-none">{endTime}</p>
                            )}
                          </div>

                          {/* Col 2: avatar empleado */}
                          <div
                            className="row-span-2 self-center w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden ring-2 ring-white shadow"
                            style={{ backgroundColor: empColor }}
                          >
                            {apt.employee?.avatarUrl ? (
                              <img src={`${API_URL}${apt.employee.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span>{apt.employee?.firstName?.[0]}{apt.employee?.lastName?.[0]}</span>
                            )}
                          </div>

                          {/* Col 3 row 1: nombre cliente */}
                          <p className="text-sm font-bold text-gray-900 truncate min-w-0">
                            {apt.client ? `${apt.client.firstName} ${apt.client.lastName}` : 'Cliente'}
                          </p>

                          {/* Col 4 row 1: precio */}
                          <p className="text-xs font-bold text-gray-900 tabular-nums whitespace-nowrap text-right">
                            {formatCurrency(totalPrice)}
                          </p>

                          {/* Col 3 row 2: servicios + empleado */}
                          <p className="text-xs text-gray-500 min-w-0 self-start leading-snug overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {services}
                            {apt.employee && (
                              <span className="text-[10px] text-gray-400"> · {apt.employee.firstName} {apt.employee.lastName}</span>
                            )}
                          </p>

                          {/* Col 4 row 2: status */}
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap self-start justify-self-end ${status.bg} ${status.textColor}`}>
                            <span className="w-1 h-1 rounded-full" style={{ backgroundColor: status.dot }} />
                            {status.text}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {startTab === 'apartados' && (
              <>
                {payableReservations.length === 0 ? (
                  <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-sm text-gray-400">
                    No hay apartados pendientes de cobro.
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-400 text-center uppercase tracking-wider">selecciona un apartado para cobrar</p>
                    <div className="space-y-2 max-h-[28rem] overflow-y-auto">
                      {payableReservations.map((r: any) => {
                        const total = Number(r.unitPrice) * Number(r.quantity);
                        const badge = r.appointmentId
                          ? { text: 'Cita cancelada', bg: 'bg-red-50', textColor: 'text-red-700', dot: '#dc2626' }
                          : { text: 'Sin cita', bg: 'bg-gray-100', textColor: 'text-gray-600', dot: '#94a3b8' };
                        return (
                          <button
                            key={r.id}
                            onClick={() => setSelectedReservationId(r.id)}
                            className="w-full bg-white rounded-2xl p-3 text-left hover:bg-gray-50 transition-colors border border-gray-200"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                {r.product?.imageUrl ? (
                                  <img src={`${API_URL}${r.product.imageUrl}`} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                                  </svg>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-bold text-gray-900 truncate">{r.product?.name || 'Producto'}</p>
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${badge.bg} ${badge.textColor}`}>
                                    <span className="w-1 h-1 rounded-full" style={{ backgroundColor: badge.dot }} />
                                    {badge.text}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 truncate mt-0.5">
                                  {r.customerName} · {r.quantity} × {formatCurrency(Number(r.unitPrice))}
                                  {r.code && <span className="font-mono ml-1.5 text-gray-400">#{r.code}</span>}
                                </p>
                              </div>
                              <p className="text-sm font-bold text-gray-900 tabular-nums whitespace-nowrap flex-shrink-0">
                                {formatCurrency(total)}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── STEP 1: Services ───
  if (step === 'services') {
    const grouped: Record<string, any[]> = {};
    filteredServices.forEach((s: any) => { const c = s.subcategory || s.category || 'General'; (grouped[c] = grouped[c] || []).push(s); });
    const noItemsYet = items.length === 0;
    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-gray-200 px-4 py-3 bg-white flex items-center gap-2">
          <button onClick={() => { if (returnToDetails) { setReturnToDetails(false); setStep('details'); } else { setStep('start'); } }} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </button>
          <h3 className="text-sm font-semibold text-gray-900 flex-1">Servicios</h3>
        </div>
        {renderStepProgress('services')}
        {renderSearchRow('Buscar servicio...')}
        <div className="flex-1 overflow-y-auto p-4">
          {/* CTA claro para venta solo de productos: si el cajero no
              tiene ningún servicio en el carrito y solo va a vender
              productos, este botón le ahorra el paso. */}
          {noItemsYet && (
            <button
              onClick={() => setStep('products')}
              className="w-full mb-4 flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-dashed border-gray-300 hover:border-[#008080] hover:bg-teal-50 transition-colors text-left group"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-white flex items-center justify-center flex-shrink-0 transition-colors">
                  <svg className="w-5 h-5 text-gray-500 group-hover:text-[#008080]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">¿Solo productos?</p>
                  <p className="text-xs text-gray-500">Salta los servicios y pasa directo a vender productos</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-[#008080] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          )}
          {renderGridSection('Servicios', grouped, 'service')}
        </div>
        {renderEmployeePicker()}
        {returnToDetails ? renderBottomBar('details', 'Volver al pedido') : renderBottomBar('products')}
      </div>
    );
  }

  // ─── STEP 2: Products ───
  if (step === 'products') {
    const grouped: Record<string, any[]> = {};
    filteredProducts.forEach((p: any) => { const c = p.category || 'General'; (grouped[c] = grouped[c] || []).push(p); });
    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-gray-200 px-4 py-3 bg-white flex items-center gap-2">
          <button onClick={() => { setReturnToDetails(false); setStep('services'); }} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </button>
          <h3 className="text-sm font-semibold text-gray-900 flex-1">Productos</h3>
          <button onClick={() => setStep('details')} className="text-xs text-gray-400 hover:text-gray-600">Saltar</button>
        </div>
        {renderStepProgress('products')}
        {renderSearchRow('Buscar producto...')}
        <div className="flex-1 overflow-y-auto p-4">
          {Object.keys(grouped).length > 0 ? renderGridSection('Productos', grouped, 'product') : (
            <p className="text-center text-sm text-gray-400 py-12">No hay productos disponibles</p>
          )}
        </div>
        {renderProductDetail()}
        {renderBottomBar('details')}
      </div>
    );
  }

  // ─── STEP 3: Details ───
  if (step === 'details') {
    // Clientes en orden alfabético (acentos respetados via locale 'es')
    const clientOptions = clients
      .slice()
      .sort((a: any, b: any) =>
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'es'),
      )
      .map((c: any) => ({
        id: c.id,
        label: `${c.firstName} ${c.lastName}`,
        sublabel: c.phone || c.email,
        initials: `${c.firstName[0]}${c.lastName[0]}`,
        avatarUrl: c.avatarUrl || null,
        color: '#008080',
      }));

    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-gray-200 px-4 py-3 bg-white flex items-center gap-2">
          <button onClick={() => setStep(selectedAppointmentId ? 'start' : 'products')} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </button>
          <h3 className="text-sm font-semibold text-gray-900 flex-1">Detalles del pedido</h3>
        </div>
        {renderStepProgress('details')}

        <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-xl mx-auto space-y-4">
          {/* Services — cada servicio con su empleado en una row separada para
              poder reasignar individualmente */}
          {serviceItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Servicios</p>
              <div className="space-y-2">
                {serviceItems.map((item) => {
                  const assignedEmp = item.employeeId ? employees.find((e: any) => e.id === item.employeeId) : null;
                  return (
                    <div key={item.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      {/* Row 1: servicio */}
                      <div className="flex items-center gap-3 p-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                          <p className="text-xs text-gray-400">{formatCurrency(item.price)} c/u</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 text-gray-600">-</button>
                          <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 text-gray-600">+</button>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 w-20 text-right">{formatCurrency(item.price * item.quantity)}</span>
                      </div>
                      {/* Row 2: empleado — avatar+nombre, click para reasignar */}
                      <button
                        onClick={() => setEmployeePickerFor(item.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 border-t border-gray-100 text-left hover:bg-gray-100 transition-colors"
                      >
                        {assignedEmp ? (
                          <>
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: assignedEmp.color || '#008080' }}>
                              {assignedEmp.avatarUrl ? <img src={`${API_URL}${assignedEmp.avatarUrl}`} alt="" className="w-full h-full object-cover" /> : <>{assignedEmp.firstName[0]}{assignedEmp.lastName[0]}</>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-gray-400">Atiende</p>
                              <p className="text-xs font-medium text-gray-900 truncate">{assignedEmp.firstName} {assignedEmp.lastName}</p>
                            </div>
                            <span className="text-[10px] text-[#008080] font-medium whitespace-nowrap">Cambiar</span>
                          </>
                        ) : (
                          <>
                            <div className="w-7 h-7 rounded-full bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0">
                              <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                              </svg>
                            </div>
                            <p className="text-xs font-medium text-red-600 flex-1">Asignar empleado</p>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => { setReturnToDetails(true); setSearch(''); setStep('services'); }}
                className="mt-2 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-sm font-medium text-[#008080] hover:border-[#008080] hover:bg-teal-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Añadir servicio
              </button>
            </div>
          )}

          {/* Products */}
          {productItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Productos</p>
              <div className="space-y-2">
                {productItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200">
                    {item.imageUrl && <img src={`${API_URL}${item.imageUrl}`} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-400">{formatCurrency(item.price)} c/u</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 text-gray-600">-</button>
                      <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 text-gray-600">+</button>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 w-20 text-right">{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Client */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">Cliente *</label>
            <SearchableSelect
              value={selectedClientId}
              onChange={(id) => {
                setSelectedClientId(id);
                // Prerrelleno SIEMPRE con el teléfono del cliente registrado
                // (10 últimos dígitos, sin prefijos). Si el cajero quiere otro
                // número, puede editarlo manualmente después.
                const c = clients.find((x: any) => x.id === id);
                if (c?.phone) {
                  const cleaned = String(c.phone).replace(/\D/g, '').slice(-10);
                  setPhone(cleaned);
                } else {
                  setPhone('');
                }
              }}
              options={clientOptions}
              placeholder="Buscar cliente..."
              allLabel="Seleccionar cliente"
            />
            <button onClick={() => setShowNewClient(true)} className="text-xs text-[#008080] hover:underline mt-2">+ Registrar nuevo cliente</button>
          </div>

          {/* Location */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">Ubicación *</label>
            <select value={selectedLocationId} onChange={(e) => setSelectedLocationId(e.target.value)} className="input-field">
              <option value="">Seleccionar...</option>
              {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          {/* Discount */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">Descuento</label>

            {/* Cupón heredado de la cita: mini-ticket con el mismo estilo
                que el catalogo/historial (stub coloreado + contenido).
                El cajero puede quitarlo si no aplica; al quitar el campo
                discount se resetea. */}
            {appointmentCoupon && (
              <div className="mb-2 relative bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm flex" style={{ minHeight: 56 }}>
                <div
                  className="w-16 flex-shrink-0 flex flex-col items-center justify-center relative"
                  style={{ backgroundColor: '#008080' }}
                >
                  <span className="text-white font-black text-sm leading-tight">-{formatCurrency(appointmentCoupon.amount)}</span>
                  <span className="text-white/70 text-[9px] uppercase tracking-wider">cupón</span>
                  <div className="absolute -right-2 -top-2 w-4 h-4 rounded-full bg-white" />
                  <div className="absolute -right-2 -bottom-2 w-4 h-4 rounded-full bg-white" />
                </div>
                <div className="flex flex-col items-center justify-center w-3 flex-shrink-0 gap-[2px] py-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="w-[2px] h-[2px] rounded-full bg-gray-300" />
                  ))}
                </div>
                <div className="flex-1 py-2 pr-2 flex items-center justify-between gap-2 min-w-0">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{appointmentCoupon.label}</p>
                    {appointmentCoupon.code && (
                      <p className="font-mono text-[10px] font-semibold text-gray-500 mt-0.5">{appointmentCoupon.code}</p>
                    )}
                  </div>
                  <button
                    onClick={() => { setAppointmentCoupon(null); setDiscount('0'); }}
                    className="flex-shrink-0 text-[10px] font-semibold text-red-600 hover:text-red-700 hover:underline px-2"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} min="0" className="input-field flex-1" placeholder="0" />
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                <button onClick={() => setDiscountType('amount')} className={`px-3 py-2 text-sm ${discountType === 'amount' ? 'bg-[#008080] text-white' : 'bg-white text-gray-700'}`}>$</button>
                <button onClick={() => setDiscountType('percent')} className={`px-3 py-2 text-sm border-l border-gray-300 ${discountType === 'percent' ? 'bg-[#008080] text-white' : 'bg-white text-gray-700'}`}>%</button>
              </div>
            </div>
            {appointmentCoupon && (
              <p className="text-[10px] text-gray-400 mt-1.5">
                El cupón ya está aplicado en este campo. Súmale más si vas a otorgar descuento adicional.
              </p>
            )}
          </div>

          {/* Tip */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-xs font-medium text-gray-600 mb-2">Propina</label>
            <div className="flex gap-2 mb-2">
              {[5, 10, 15].map((pct) => (
                <button key={pct} onClick={() => { setTipPercent(tipPercent === pct ? null : pct); setTipManual(''); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tipPercent === pct ? 'bg-[#008080] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {pct}%
                </button>
              ))}
              <button onClick={() => { setTipPercent(null); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tipPercent === null && tipManual ? 'bg-[#008080] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                Otro
              </button>
            </div>
            {tipPercent === null && (
              <input type="number" value={tipManual} onChange={(e) => setTipManual(e.target.value)} min="0" className="input-field" placeholder="Monto de propina" />
            )}
            {tipAmount > 0 && <p className="text-xs text-gray-400 mt-1">Propina: {formatCurrency(tipAmount)}</p>}
          </div>

          {/* Phone — solo 10 dígitos para enviar el recibo por WhatsApp */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono para recibo (WhatsApp)</label>
            <div className="flex items-stretch gap-0 border border-gray-200 rounded-lg overflow-hidden focus-within:border-[#008080] focus-within:ring-1 focus-within:ring-[#008080]">
              <span className="inline-flex items-center px-3 bg-gray-50 text-sm font-medium text-gray-500 border-r border-gray-200">+52</span>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="flex-1 px-3 py-2 text-sm focus:outline-none"
                placeholder="10 dígitos"
                maxLength={10}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Recibirá los detalles del pedido por WhatsApp para mayor confianza.
              {phone.length > 0 && phone.length < 10 && <span className="text-red-500 ml-1">Faltan {10 - phone.length} dígitos.</span>}
            </p>
          </div>

          {/* Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-600">Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
              {discountAmount > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">Descuento</span><span className="font-medium text-green-600">-{formatCurrency(discountAmount)}</span></div>}
              {tipAmount > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">Propina</span><span className="font-medium">{formatCurrency(tipAmount)}</span></div>}
              <div className="flex justify-between pt-2 border-t border-gray-200"><span className="font-bold text-gray-900">Total</span><span className="font-bold text-xl text-[#008080]">{formatCurrency(total)}</span></div>
            </div>
          </div>
        </div>
        </div>

        {renderEmployeePicker()}

        {/* New client modal */}
        {showNewClient && (
          <Modal title="Registrar Cliente" onClose={() => setShowNewClient(false)}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label><input type="text" value={newClient.firstName} onChange={(e) => setNewClient((c) => ({ ...c, firstName: e.target.value }))} className="input-field" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Apellido *</label><input type="text" value={newClient.lastName} onChange={(e) => setNewClient((c) => ({ ...c, lastName: e.target.value }))} className="input-field" /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Email</label><input type="email" value={newClient.email} onChange={(e) => setNewClient((c) => ({ ...c, email: e.target.value }))} className="input-field" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label><input type="tel" value={newClient.phone} onChange={(e) => setNewClient((c) => ({ ...c, phone: e.target.value }))} className="input-field" /></div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowNewClient(false)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={() => { if (!newClient.firstName || !newClient.lastName) return; createClientMutation.mutate(newClient); }}
                  disabled={createClientMutation.isPending} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#008080' }}>
                  {createClientMutation.isPending ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </div>
          </Modal>
        )}

        <div className="border-t border-gray-200 bg-white px-6 py-3">
          <div className="max-w-xl mx-auto">
            <button onClick={() => setStep('pay')} disabled={items.length === 0}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#008080' }}>
              Continuar al pago
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── STEP 5: Receipt (post-pago) — enviar comprobante + confirmar ───
  if (step === 'receipt') {
    const isTransfer = paymentMethod === 'TRANSFER';
    const clientForReceipt = clients.find((c: any) => c.id === selectedClientId);
    const receiptMessage = [
      '*Comprobante de tu pedido*',
      clientForReceipt ? `Cliente: ${clientForReceipt.firstName} ${clientForReceipt.lastName}` : '',
      serviceItems.length > 0 ? `\n*Servicios:*\n${serviceItems.map((i) => `• ${i.quantity}× ${i.name}${i.employeeName ? ` con ${i.employeeName}` : ''} — ${formatCurrency(i.price * i.quantity)}`).join('\n')}` : '',
      productItems.length > 0 ? `\n*Productos:*\n${productItems.map((i) => `• ${i.quantity}× ${i.name} — ${formatCurrency(i.price * i.quantity)}`).join('\n')}` : '',
      discountAmount > 0 ? `\nDescuento: -${formatCurrency(discountAmount)}` : '',
      tipAmount > 0 ? `Propina: ${formatCurrency(tipAmount)}` : '',
      `\n*Total pagado: ${formatCurrency(total)}*`,
      `Método de pago: ${paymentMethod === 'CASH' ? 'Efectivo' : paymentMethod === 'CARD' ? 'Tarjeta' : 'Transferencia'}`,
      '\n¡Gracias por tu compra!',
    ].filter(Boolean).join('\n');
    const whatsappUrl = phone.length === 10
      ? `https://wa.me/52${phone}?text=${encodeURIComponent(receiptMessage)}`
      : null;

    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-gray-200 px-4 py-3 bg-white flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 flex-1">Comprobante</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-xl mx-auto">
            {/* Confirmación visual de éxito */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Pago procesado</h2>
              <p className="text-sm text-gray-500">Total cobrado: <span className="font-bold text-[#008080]">{formatCurrency(total)}</span></p>
            </div>

            {/* Resumen breve */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <p className="text-xs text-gray-400 uppercase mb-2">Resumen</p>
              <div className="space-y-1 text-sm">
                {clientForReceipt && (
                  <p className="text-gray-700"><span className="text-gray-500">Cliente:</span> {clientForReceipt.firstName} {clientForReceipt.lastName}</p>
                )}
                <p className="text-gray-700">
                  <span className="text-gray-500">Método:</span> {paymentMethod === 'CASH' ? 'Efectivo' : paymentMethod === 'CARD' ? 'Tarjeta' : 'Transferencia'}
                </p>
                <p className="text-gray-700"><span className="text-gray-500">Items:</span> {totalItems}</p>
              </div>
            </div>

            {/* QR de reseña — solo cuando se cobró una cita y el cajero no
                ha saltado la reseña. Si el cliente no quiere o no puede,
                "Saltar reseña" la oculta; el cliente la dejará luego desde
                /marketplace/appointments. */}
            {confirmationToken && !reviewSkipped && (
              <div className="bg-white rounded-xl border-2 border-teal-200 p-4 mb-4">
                <p className="text-xs font-semibold text-teal-700 uppercase tracking-wider mb-1">Reseña del cliente</p>
                <p className="text-sm text-gray-600 mb-3">
                  Pide al cliente que escanee el QR para calificar el servicio.
                </p>
                <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-center mb-3">
                  <div className="bg-white p-2 rounded-lg">
                    <QRCodeSVG
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/confirm-payment/${confirmationToken}`}
                      size={160}
                      level="M"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewSkipped(true)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  Saltar reseña — el cliente la deja después
                </button>
              </div>
            )}

            {/* Enviar comprobante por WhatsApp */}
            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-white bg-[#25D366] hover:bg-[#20BD5A] transition-colors mb-3"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492l4.625-1.476A11.929 11.929 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-2.115 0-4.142-.657-5.85-1.898l-.42-.298-2.744.877.87-2.684-.32-.438A9.723 9.723 0 012.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75z"/></svg>
                Enviar comprobante por WhatsApp
              </a>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Teléfono del cliente para enviar el comprobante
                </label>
                <div className="flex items-stretch gap-0 border border-gray-200 rounded-lg overflow-hidden focus-within:border-[#008080] focus-within:ring-1 focus-within:ring-[#008080]">
                  <span className="inline-flex items-center px-3 bg-gray-50 text-sm font-medium text-gray-500 border-r border-gray-200">+52</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="flex-1 px-3 py-2 text-sm focus:outline-none"
                    placeholder="10 dígitos"
                    maxLength={10}
                  />
                </div>
                {phone.length > 0 && phone.length < 10 && (
                  <p className="text-[10px] text-red-500 mt-1">Faltan {10 - phone.length} dígitos.</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 bg-white px-6 py-3">
          <div className="max-w-xl mx-auto space-y-2">
            {/* Flujo de comprobante para TRANSFERENCIA — el orden es:
                1) Adjuntar comprobante (file input)
                2) Omitir comprobante (continuar sin él)
                3) Confirmar pago (cierra el flujo) — siempre último */}
            {isTransfer && pendingPaymentId && (
              <>
                {transferProofPreview ? (
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-2 flex items-center gap-2">
                    <img src={transferProofPreview} alt="Comprobante" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900">Comprobante adjuntado</p>
                      <p className="text-[10px] text-gray-500 truncate">{transferProofFile?.name}</p>
                    </div>
                    <button
                      onClick={() => { setTransferProofFile(null); setTransferProofPreview(null); }}
                      className="text-[10px] text-red-500 font-medium"
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <>
                    <label className="block w-full py-2.5 rounded-xl text-sm font-medium text-center border-2 border-dashed border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setTransferProofFile(f);
                          if (f.type.startsWith('image/')) {
                            const reader = new FileReader();
                            reader.onload = () => setTransferProofPreview(reader.result as string);
                            reader.readAsDataURL(f);
                          } else {
                            setTransferProofPreview('pdf');
                          }
                          uploadProofMutation.mutate(f);
                        }}
                      />
                      {uploadProofMutation.isPending ? 'Subiendo...' : 'Añadir comprobante'}
                    </label>
                    {uploadProofMutation.isError && (
                      <p className="text-[10px] text-red-500 text-center">No se pudo subir el comprobante. Reintenta.</p>
                    )}
                    <button
                      onClick={() => { setTransferProofFile(null); setTransferProofPreview('skipped'); }}
                      className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      Omitir comprobante
                    </button>
                  </>
                )}
              </>
            )}

            <button
              onClick={() => {
                // Si hubo cliente conocido en la venta, ofrecemos reagendar.
                // El modal se encarga de redirigir o cerrar.
                if (selectedClientId) setShowRebook(true);
                else resetCheckout();
              }}
              disabled={isTransfer && pendingPaymentId != null && !transferProofPreview}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#008080' }}
            >
              {isTransfer ? 'Confirmar pago' : 'Nueva venta'}
            </button>
          </div>
        </div>

        <RebookPromptModal
          show={showRebook}
          clientId={selectedClientId}
          clientFirstName={clientForReceipt?.firstName || 'el cliente'}
          onDismiss={() => { setShowRebook(false); resetCheckout(); }}
        />
      </div>
    );
  }

  // ─── STEP 4: Pay ───
  const clientForReceipt = clients.find((c: any) => c.id === selectedClientId);
  const receiptMessage = [
    '*Detalles de tu pedido*',
    clientForReceipt ? `Cliente: ${clientForReceipt.firstName} ${clientForReceipt.lastName}` : '',
    serviceItems.length > 0 ? `\n*Servicios:*\n${serviceItems.map((i) => `• ${i.quantity}× ${i.name}${i.employeeName ? ` con ${i.employeeName}` : ''} — ${formatCurrency(i.price * i.quantity)}`).join('\n')}` : '',
    productItems.length > 0 ? `\n*Productos:*\n${productItems.map((i) => `• ${i.quantity}× ${i.name} — ${formatCurrency(i.price * i.quantity)}`).join('\n')}` : '',
    discountAmount > 0 ? `\nDescuento: -${formatCurrency(discountAmount)}` : '',
    tipAmount > 0 ? `Propina: ${formatCurrency(tipAmount)}` : '',
    `\n*Total: ${formatCurrency(total)}*`,
    `Método de pago: ${paymentMethod === 'CASH' ? 'Efectivo' : paymentMethod === 'CARD' ? 'Tarjeta' : 'Transferencia'}`,
  ].filter(Boolean).join('\n');
  const receiptWhatsappUrl = phone.length === 10
    ? `https://wa.me/52${phone}?text=${encodeURIComponent(receiptMessage)}`
    : null;

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gray-200 px-4 py-3 bg-white flex items-center gap-2">
        <button onClick={() => setStep('details')} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <h3 className="text-sm font-semibold text-gray-900 flex-1">Pago</h3>
      </div>
      {renderStepProgress('pay')}

      <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Payment methods */}
        <div className="grid grid-cols-3 gap-3">
          {([
            { value: 'CASH' as PaymentMethod, label: 'Efectivo', icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z' },
            { value: 'CARD' as PaymentMethod, label: 'Tarjeta', icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z' },
            { value: 'TRANSFER' as PaymentMethod, label: 'Transferencia', icon: 'M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z' },
          ]).map(({ value, label, icon }) => (
            <button key={value} onClick={() => setPaymentMethod(value)}
              className={`flex flex-col items-center gap-2 py-6 rounded-xl border-2 transition-all ${paymentMethod === value ? 'border-[#008080] bg-teal-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <svg className={`w-8 h-8 ${paymentMethod === value ? 'text-[#008080]' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
              </svg>
              <span className={`text-sm font-medium ${paymentMethod === value ? 'text-[#008080]' : 'text-gray-600'}`}>{label}</span>
            </button>
          ))}
        </div>

        {/* Cash: change calculator */}
        {paymentMethod === 'CASH' && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">El cliente paga con:</label>
            <input type="number" value={cashGiven} onChange={(e) => setCashGiven(e.target.value)} min="0" step="0.01" className="input-field text-lg font-bold" placeholder="0.00" />
            {parseFloat(cashGiven) >= total && (
              <div className="mt-3 p-3 bg-teal-50 rounded-lg text-center">
                <p className="text-xs text-gray-500">Cambio</p>
                <p className="text-2xl font-bold text-[#008080]">{formatCurrency(cashChange)}</p>
              </div>
            )}
          </div>
        )}

        {/* Transfer: datos bancarios para enviar al cliente */}
        {paymentMethod === 'TRANSFER' && (() => {
          const bank = tenantData?.data?.shopSpeiBankName;
          const holder = tenantData?.data?.shopSpeiHolderName;
          const clabe = tenantData?.data?.shopSpeiClabe;
          const bankInfoConfigured = !!(bank && holder && clabe);
          const clientPhoneClean = phone.length === 10 ? phone : null;
          const bankMessage = `*Datos para transferencia*\nBanco: ${bank}\nTitular: ${holder}\nCLABE: ${clabe}\n\n*Total a transferir: ${formatCurrency(total)}*\n\nUna vez realizada la transferencia, envíanos el comprobante para confirmar tu pago.`;
          const whatsappBankUrl = clientPhoneClean
            ? `https://wa.me/52${clientPhoneClean}?text=${encodeURIComponent(bankMessage)}`
            : null;

          return (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-700 mb-2">Datos bancarios para el cliente</p>
              {!bankInfoConfigured ? (
                <p className="text-xs text-amber-600">Configura los datos bancarios del negocio en Configuración → Tienda para poder enviarlos.</p>
              ) : (
                <>
                  <div className="space-y-1 text-xs mb-3">
                    <p><span className="text-gray-500">Banco:</span> <span className="font-medium text-gray-900">{bank}</span></p>
                    <p><span className="text-gray-500">Titular:</span> <span className="font-medium text-gray-900">{holder}</span></p>
                    <p><span className="text-gray-500">CLABE:</span> <span className="font-mono font-medium text-gray-900">{clabe}</span></p>
                    <p><span className="text-gray-500">Total:</span> <span className="font-bold text-[#008080]">{formatCurrency(total)}</span></p>
                  </div>
                  {whatsappBankUrl ? (
                    <a
                      href={whatsappBankUrl}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-[#25D366] hover:bg-[#20BD5A] transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492l4.625-1.476A11.929 11.929 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-2.115 0-4.142-.657-5.85-1.898l-.42-.298-2.744.877.87-2.684-.32-.438A9.723 9.723 0 012.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75z"/></svg>
                      Enviar datos al cliente
                    </a>
                  ) : (
                    <p className="text-[10px] text-gray-400 text-center">Captura el teléfono del cliente (10 dígitos) en la sección anterior para habilitar el envío por WhatsApp.</p>
                  )}
                </>
              )}
            </div>
          );
        })()}

        {/* Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-400 uppercase mb-3">Resumen</p>
          <div className="space-y-1.5 text-sm">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span className="text-gray-600">{item.quantity}× {item.name}{item.employeeName ? ` (${item.employeeName})` : ''}</span>
                <span className="text-gray-900">{formatCurrency(item.price * item.quantity)}</span>
              </div>
            ))}
            {discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Descuento</span><span>-{formatCurrency(discountAmount)}</span></div>}
            {tipAmount > 0 && <div className="flex justify-between"><span className="text-gray-600">Propina</span><span>{formatCurrency(tipAmount)}</span></div>}
          </div>
          <div className="flex justify-between pt-3 mt-3 border-t border-gray-200">
            <span className="text-lg font-bold text-gray-900">Total</span>
            <span className="text-2xl font-bold text-[#008080]">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* El envío del recibo por WhatsApp vive en el paso siguiente
            (Comprobante) — el flujo es lineal: primero cobrar, luego
            enviar comprobante. Eso evita que el cajero mande comprobante
            antes de procesar el pago. */}
        {phone.length === 10 && (
          <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-800">
            Tras cobrar podrás enviar el comprobante por WhatsApp al cliente.
          </div>
        )}

        {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
      </div>
      </div>

      <div className="border-t border-gray-200 bg-white px-6 py-4">
        <div className="max-w-xl mx-auto">
          <button onClick={handlePay} disabled={processPayment.isPending}
            className="w-full py-4 rounded-xl text-base font-bold text-white transition-colors disabled:opacity-50" style={{ backgroundColor: '#008080' }}>
            {processPayment.isPending ? 'Procesando...' : `Cobrar ${formatCurrency(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

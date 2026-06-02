'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/hooks/use-currency';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Modal } from '@/components/ui/modal';
import { formatBookingTime, formatBookingDay, formatBookingMonthShort } from '@/lib/booking-time';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER';
type Step = 'start' | 'services' | 'products' | 'details' | 'pay' | 'receipt';

interface PosCheckoutProps {
  onComplete: () => void;
  /** Si viene una cita preseleccionada (ej: desde "Proceder al pago" en el
   * detalle de cita), el POS arranca con ella ya cargada en el step de
   * detalles, listo para cobrar. */
  initialAppointmentId?: string;
}

export function PosCheckout({ onComplete, initialAppointmentId }: PosCheckoutProps) {
  const { format: formatCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('start');
  const [items, setItems] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [discount, setDiscount] = useState('0');
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [tipPercent, setTipPercent] = useState<number | null>(null);
  const [tipManual, setTipManual] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [cashGiven, setCashGiven] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [employeePickerFor, setEmployeePickerFor] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(initialAppointmentId || null);
  // Marca que appointment ya pre-cargamos (cliente, items, phone). Evita
  // que refetches del query "pos-appointments" sobrescriban lo que el
  // cajero acabe de editar.
  const loadedAppointmentRef = useRef<string | null>(null);
  const [productDetail, setProductDetail] = useState<any | null>(null);
  const [transferProofFile, setTransferProofFile] = useState<File | null>(null);
  const [transferProofPreview, setTransferProofPreview] = useState<string | null>(null);
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);

  // Queries
  const today = new Date().toISOString().split('T')[0];
  const { data: appointmentsData } = useQuery({
    queryKey: ['pos-appointments', today],
    queryFn: () => api.get<{ data: any[] }>(`/api/appointments?startDate=${today}&endDate=${today}&perPage=50`),
  });
  const { data: servicesData } = useQuery({ queryKey: ['pos-services'], queryFn: () => api.get<{ data: any[] }>('/api/services?perPage=100') });
  const { data: productsData } = useQuery({ queryKey: ['pos-products'], queryFn: () => api.get<{ data: any[] }>('/api/products?perPage=100') });
  const { data: employeesData } = useQuery({ queryKey: ['pos-employees'], queryFn: () => api.get<{ data: any[] }>('/api/employees?perPage=100') });
  const { data: locationsData } = useQuery({ queryKey: ['pos-locations'], queryFn: () => api.get<{ data: any[] }>('/api/locations') });
  const { data: clientsData } = useQuery({ queryKey: ['pos-clients'], queryFn: () => api.get<{ data: any[] }>('/api/clients?perPage=100') });
  const { data: tenantData } = useQuery({ queryKey: ['tenant-current'], queryFn: () => api.get<{ data: any }>('/api/tenants/current') });

  const appointments = (appointmentsData?.data || []).filter((a: any) => ['CONFIRMED', 'PENDING', 'IN_PROGRESS'].includes(a.status));
  const services = servicesData?.data || [];
  const products = (productsData?.data || []).filter((p: any) => p.isActive && p.isShopListed && p.stock > 0);
  const employees = (employeesData?.data || []).filter((e: any) => e.isActive);
  const locations = locationsData?.data || [];
  const clients = clientsData?.data || [];
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
    if (apt.items?.length) {
      setItems(apt.items.map((item: any) => ({
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
    setStep('details');
  }, [selectedAppointmentId, appointments]);

  const filteredServices = search ? services.filter((s: any) => s.name.toLowerCase().includes(search.toLowerCase())) : services;
  const filteredProducts = search ? products.filter((p: any) => p.name.toLowerCase().includes(search.toLowerCase())) : products;

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
  function updateQuantity(id: string, qty: number) {
    if (qty <= 0) setItems((prev) => prev.filter((i) => i.id !== id));
    else setItems((prev) => prev.map((i) => i.id === id ? { ...i, quantity: qty } : i));
  }
  function assignEmployee(itemId: string, empId: string, empName: string) {
    setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, employeeId: empId, employeeName: empName } : i));
    setEmployeePickerFor(null);
  }
  function getCartQty(id: string) { return items.find((i) => i.id === id)?.quantity || 0; }

  const serviceItems = items.filter((i) => i.type === 'service');
  const productItems = items.filter((i) => i.type === 'product');
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const discountAmount = discountType === 'percent' ? subtotal * ((parseFloat(discount) || 0) / 100) : (parseFloat(discount) || 0);
  const tipAmount = tipPercent != null ? subtotal * (tipPercent / 100) : (parseFloat(tipManual) || 0);
  const total = Math.max(0, subtotal - discountAmount) + tipAmount;
  const cashChange = Math.max(0, (parseFloat(cashGiven) || 0) - total);

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

  // Process payment
  const processPayment = useMutation({
    mutationFn: async (payload: any): Promise<{ appointmentId: string | null }> => {
      const payRes = await api.post<{ data: any }>('/api/payments', payload);
      let appointmentId: string | null = selectedAppointmentId;
      // Create appointment from POS if no existing appointment
      if (!selectedAppointmentId && serviceItems.length > 0) {
        const aptRes = await api.post<{ data: any }>('/api/appointments/from-pos', {
          clientId: payload.clientId,
          locationId: payload.locationId,
          serviceAssignments: serviceItems.map((i) => ({
            serviceId: i.id.replace('svc-', ''),
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
      setPendingPaymentId(appointmentId);
      // Invalida historial y citas del POS para que al cambiar de tab la
      // venta recién registrada aparezca al instante (sin esto el cache
      // de React Query devuelve los datos viejos).
      queryClient.invalidateQueries({ queryKey: ['pos-history'] });
      queryClient.invalidateQueries({ queryKey: ['pos-appointments'] });
      setStep('receipt');
    },
    onError: (err: any) => setError(err.message || 'Error al procesar el pago'),
  });

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
    setStep('start');
  }

  function handlePay() {
    if (!selectedClientId) { setError('Selecciona un cliente'); return; }
    if (!selectedLocationId) { setError('Selecciona una ubicación'); return; }
    const unassigned = serviceItems.filter((i) => !i.employeeId);
    if (unassigned.length > 0) { setError(`Asigna un empleado a: ${unassigned.map((i) => i.name).join(', ')}`); return; }
    setError(null);

    processPayment.mutate({
      appointmentId: selectedAppointmentId || undefined,
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
      notes: phone ? `Recibo al: ${phone}` : undefined,
    });
  }

  // Progress bar — mismo patrón visual que el flujo de reserva del cliente
  function renderStepProgress(active: 'services' | 'products' | 'details' | 'pay') {
    const steps: { key: 'services' | 'products' | 'details' | 'pay'; label: string }[] = [
      { key: 'services', label: 'Servicios' },
      { key: 'products', label: 'Productos' },
      { key: 'details', label: 'Detalles' },
      { key: 'pay', label: 'Pago' },
    ];
    const currentIdx = steps.findIndex((s) => s.key === active);
    return (
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          {steps.map(({ key, label }, idx) => {
            // Estados visuales — usan vars CSS para los pasos NO completados
            // de modo que el modo oscuro los respete. El paso completado se
            // mantiene en teal sólido (color de marca).
            const isDone = currentIdx > idx;
            const isCurrent = currentIdx === idx;
            const circleStyle: React.CSSProperties = isDone
              ? { backgroundColor: '#008080', color: '#fff' }
              : isCurrent
                ? { backgroundColor: 'var(--primary-tint)', color: '#008080', border: '2px solid #008080' }
                : { backgroundColor: 'var(--bg-muted)', color: 'var(--text-tertiary)' };
            const labelColor = isCurrent ? '#008080' : 'var(--text-tertiary)';
            const connectorBg = isDone ? '#008080' : 'var(--border)';
            return (
              <div key={key} className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0" style={circleStyle}>
                    {isDone ? '✓' : idx + 1}
                  </div>
                  <span
                    className="text-xs hidden sm:block"
                    style={{ color: labelColor, fontWeight: isCurrent ? 500 : 400 }}
                  >
                    {label}
                  </span>
                </div>
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
            <h2 className="text-lg font-semibold text-gray-900 text-center mb-6">¿Cómo deseas iniciar?</h2>

            <button onClick={() => setStep('services')}
              className="w-full p-5 bg-white rounded-xl border-2 border-gray-200 hover:border-[#008080] hover:bg-teal-50 transition-all text-left">
              <p className="text-sm font-semibold text-gray-900">Venta directa</p>
              <p className="text-xs text-gray-500 mt-0.5">Sin cita previa — selecciona servicios y productos</p>
            </button>

            {appointments.length > 0 && (
              <>
                <p className="text-xs text-gray-400 text-center uppercase tracking-wider">o selecciona una cita de hoy</p>
                <div className="space-y-2 max-h-[28rem] overflow-y-auto">
                  {appointments.map((apt: any) => {
                    const services = apt.items?.map((i: any) => i.serviceNameSnapshot).join(', ') || '—';
                    const totalPrice = (apt.items || []).reduce((s: number, i: any) => s + Number(i.priceSnapshot || 0), 0);
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
                    const status = statusInfo[apt.status] || { text: apt.status, bg: 'bg-gray-100', textColor: 'text-gray-600', dot: '#94a3b8' };

                    return (
                      <button
                        key={apt.id}
                        onClick={() => setSelectedAppointmentId(apt.id)}
                        className="w-full bg-white rounded-2xl border border-gray-200 p-3 text-left hover:bg-gray-50 transition-colors"
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
          <button onClick={() => setStep('start')} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
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
        {renderBottomBar('products')}
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
          <button onClick={() => setStep('services')} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
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
            <div className="flex gap-2">
              <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} min="0" className="input-field flex-1" placeholder="0" />
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                <button onClick={() => setDiscountType('amount')} className={`px-3 py-2 text-sm ${discountType === 'amount' ? 'bg-[#008080] text-white' : 'bg-white text-gray-700'}`}>$</button>
                <button onClick={() => setDiscountType('percent')} className={`px-3 py-2 text-sm border-l border-gray-300 ${discountType === 'percent' ? 'bg-[#008080] text-white' : 'bg-white text-gray-700'}`}>%</button>
              </div>
            </div>
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
              onClick={resetCheckout}
              disabled={isTransfer && pendingPaymentId != null && !transferProofPreview}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#008080' }}
            >
              {isTransfer ? 'Confirmar pago' : 'Nueva venta'}
            </button>
          </div>
        </div>
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

'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/hooks/use-currency';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Modal } from '@/components/ui/modal';

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
type Step = 'start' | 'services' | 'products' | 'details' | 'pay';

interface PosCheckoutProps {
  onComplete: () => void;
}

export function PosCheckout({ onComplete }: PosCheckoutProps) {
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
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

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

  // Pre-load from appointment
  useEffect(() => {
    if (!selectedAppointmentId) return;
    const apt = appointments.find((a: any) => a.id === selectedAppointmentId);
    if (!apt) return;
    if (apt.client) { setSelectedClientId(apt.clientId); setPhone(apt.client.phone || ''); }
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
  }, [selectedAppointmentId]);

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
    mutationFn: async (payload: any) => {
      const payRes = await api.post<{ data: any }>('/api/payments', payload);
      // Create appointment from POS if no existing appointment
      if (!selectedAppointmentId && serviceItems.length > 0) {
        await api.post('/api/appointments/from-pos', {
          clientId: payload.clientId,
          locationId: payload.locationId,
          serviceAssignments: serviceItems.map((i) => ({
            serviceId: i.id.replace('svc-', ''),
            employeeId: i.employeeId,
          })).filter((a) => a.employeeId),
          notes: 'Venta desde POS',
        });
      }
      return payRes;
    },
    onSuccess: () => onComplete(),
    onError: (err: any) => setError(err.message || 'Error al procesar el pago'),
  });

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

  // Shared components
  function renderCard(id: string, name: string, price: number, type: 'service' | 'product', imageUrl?: string, duration?: number) {
    const qty = getCartQty(id);
    const cartItem = items.find((i) => i.id === id);
    const assignedEmp = cartItem?.employeeId ? employees.find((e: any) => e.id === cartItem.employeeId) : null;
    return (
      <div key={id} className={`relative bg-white rounded-xl border-2 overflow-hidden transition-all hover:shadow-md ${qty > 0 ? 'border-[#008080]' : 'border-gray-200 hover:border-gray-300'}`}>
        <button onClick={() => { if (qty === 0) addToCart(id, name, price, type, imageUrl, duration); }} className="w-full text-left">
          {type === 'product' && (
            <div className="aspect-[5/3] bg-gray-100 flex items-center justify-center overflow-hidden">
              {imageUrl ? <img src={`${API_URL}${imageUrl}`} alt="" className="w-full h-full object-cover" /> : (
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4" /></svg>
              )}
            </div>
          )}
          <div className="p-3">
            <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
            <p className="text-sm font-bold text-[#008080] mt-0.5">{formatCurrency(price)}</p>
          </div>
        </button>
        {type === 'service' && qty > 0 && assignedEmp && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/90 backdrop-blur rounded-full shadow-sm border border-gray-200 px-1.5 py-0.5">
            <div className="w-4 h-4 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-[7px] font-bold text-white" style={{ backgroundColor: assignedEmp.color || '#008080' }}>
              {assignedEmp.avatarUrl ? <img src={`${API_URL}${assignedEmp.avatarUrl}`} alt="" className="w-full h-full object-cover" /> : assignedEmp.firstName[0]}
            </div>
            <span className="text-[10px] text-gray-700 font-medium">{assignedEmp.firstName}</span>
          </div>
        )}
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

  function renderEmployeePicker() {
    if (!employeePickerFor) return null;
    return (
      <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => { setEmployeePickerFor(null); updateQuantity(employeePickerFor, 0); }}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
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
            item.name, Number(item.price), type, item.imageUrl, item.durationMinutes,
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
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {appointments.map((apt: any) => (
                    <button key={apt.id} onClick={() => setSelectedAppointmentId(apt.id)}
                      className="w-full p-4 bg-white rounded-xl border border-gray-200 hover:border-[#008080] transition-all text-left">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-900">
                          {apt.client ? `${apt.client.firstName} ${apt.client.lastName}` : 'Cliente'}
                        </p>
                        <p className="text-xs text-gray-500">{new Date(apt.startTime).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      {apt.items?.length > 0 && (
                        <p className="text-xs text-gray-400">{apt.items.map((i: any) => i.serviceNameSnapshot).join(', ')}</p>
                      )}
                    </button>
                  ))}
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
    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-gray-200 px-6 py-3 bg-white flex items-center gap-3">
          <button onClick={() => setStep('start')} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </button>
          <h3 className="text-sm font-semibold text-gray-900">Paso 1 — Servicios</h3>
          <div className="ml-auto relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar servicio..." className="text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-2 w-52 focus:border-[#008080] focus:ring-1 focus:ring-[#008080]" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{renderGridSection('Servicios', grouped, 'service')}</div>
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
        <div className="border-b border-gray-200 px-6 py-3 bg-white flex items-center gap-3">
          <button onClick={() => setStep('services')} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </button>
          <h3 className="text-sm font-semibold text-gray-900">Paso 2 — Productos</h3>
          <div className="ml-auto relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto..." className="text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-2 w-52 focus:border-[#008080] focus:ring-1 focus:ring-[#008080]" />
          </div>
          <button onClick={() => setStep('details')} className="text-xs text-gray-400 hover:text-gray-600">Saltar</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {Object.keys(grouped).length > 0 ? renderGridSection('Productos', grouped, 'product') : (
            <p className="text-center text-sm text-gray-400 py-12">No hay productos disponibles</p>
          )}
        </div>
        {renderBottomBar('details')}
      </div>
    );
  }

  // ─── STEP 3: Details ───
  if (step === 'details') {
    const clientOptions = clients.map((c: any) => ({ id: c.id, label: `${c.firstName} ${c.lastName}`, sublabel: c.phone || c.email, initials: `${c.firstName[0]}${c.lastName[0]}`, avatarUrl: c.avatarUrl || null, color: '#008080' }));
    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-gray-200 px-6 py-3 bg-white flex items-center gap-3">
          <button onClick={() => setStep('products')} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </button>
          <h3 className="text-sm font-semibold text-gray-900">Detalles del pedido</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-xl mx-auto space-y-4">
          {/* Services */}
          {serviceItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Servicios</p>
              <div className="space-y-2">
                {serviceItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-gray-400">{formatCurrency(item.price)} c/u</p>
                        {item.employeeName ? (
                          <span className="text-[10px] text-[#008080] bg-teal-50 px-1.5 py-0.5 rounded-full">{item.employeeName}</span>
                        ) : (
                          <button onClick={() => setEmployeePickerFor(item.id)} className="text-[10px] text-red-500 font-medium">Asignar empleado</button>
                        )}
                      </div>
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
            <SearchableSelect value={selectedClientId} onChange={setSelectedClientId}
              options={clientOptions} placeholder="Buscar cliente..." allLabel="Seleccionar cliente" />
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

          {/* Phone */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono para recibo</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field" placeholder="+52 000 000 0000" />
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

  // ─── STEP 4: Pay ───
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gray-200 px-6 py-3 bg-white flex items-center gap-3">
        <button onClick={() => setStep('details')} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <h3 className="text-sm font-semibold text-gray-900">Pago</h3>
      </div>

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

        {/* Transfer: WhatsApp */}
        {paymentMethod === 'TRANSFER' && posWhatsapp && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-500 mb-3">Envía los datos de la transferencia por WhatsApp</p>
            <a
              href={`https://wa.me/${posWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                `*Transferencia POS*\nTotal: ${formatCurrency(total)}\nCliente: ${clients.find((c: any) => c.id === selectedClientId)?.firstName || ''} ${clients.find((c: any) => c.id === selectedClientId)?.lastName || ''}\nServicios: ${serviceItems.map((i) => i.name).join(', ')}\n${productItems.length > 0 ? `Productos: ${productItems.map((i) => i.name).join(', ')}` : ''}`
              )}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#25D366] hover:bg-[#20BD5A] transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492l4.625-1.476A11.929 11.929 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-2.115 0-4.142-.657-5.85-1.898l-.42-.298-2.744.877.87-2.684-.32-.438A9.723 9.723 0 012.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75z"/></svg>
              Enviar por WhatsApp
            </a>
          </div>
        )}

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

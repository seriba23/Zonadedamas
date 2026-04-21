'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/hooks/use-currency';

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
}

type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER';
type Step = 'catalog' | 'review' | 'pay';

interface PosCheckoutProps {
  onComplete: () => void;
}

export function PosCheckout({ onComplete }: PosCheckoutProps) {
  const { format: formatCurrency } = useCurrency();
  const [step, setStep] = useState<Step>('catalog');
  const [items, setItems] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [discount, setDiscount] = useState('0');
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [tip, setTip] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [employeePickerFor, setEmployeePickerFor] = useState<string | null>(null);

  // Queries
  const { data: servicesData } = useQuery({
    queryKey: ['pos-services'],
    queryFn: () => api.get<{ data: any[] }>('/api/services?perPage=100'),
  });
  const { data: productsData } = useQuery({
    queryKey: ['pos-products'],
    queryFn: () => api.get<{ data: any[] }>('/api/products?perPage=100'),
  });
  const { data: employeesData } = useQuery({
    queryKey: ['pos-employees'],
    queryFn: () => api.get<{ data: any[] }>('/api/employees?perPage=100'),
  });
  const { data: locationsData } = useQuery({
    queryKey: ['pos-locations'],
    queryFn: () => api.get<{ data: any[] }>('/api/locations'),
  });
  const { data: clientsData } = useQuery({
    queryKey: ['pos-clients'],
    queryFn: () => api.get<{ data: any[] }>('/api/clients?perPage=100'),
  });

  const services = servicesData?.data || [];
  const products = (productsData?.data || []).filter((p: any) => p.isActive && p.stock > 0);
  const employees = (employeesData?.data || []).filter((e: any) => e.isActive);
  const locations = locationsData?.data || [];
  const clients = clientsData?.data || [];

  const filteredServices = search ? services.filter((s: any) => s.name.toLowerCase().includes(search.toLowerCase())) : services;
  const filteredProducts = search ? products.filter((p: any) => p.name.toLowerCase().includes(search.toLowerCase())) : products;

  // Cart helpers
  function addToCart(id: string, name: string, price: number, type: 'service' | 'product', imageUrl?: string) {
    const existing = items.find((i) => i.id === id);
    if (existing) {
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setItems((prev) => [...prev, { id, name, price, quantity: 1, type, imageUrl }]);
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

  // Totals
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const discountAmount = discountType === 'percent' ? subtotal * ((parseFloat(discount) || 0) / 100) : (parseFloat(discount) || 0);
  const tipAmount = parseFloat(tip) || 0;
  const total = Math.max(0, subtotal - discountAmount) + tipAmount;

  // Payment
  const processPayment = useMutation({
    mutationFn: (payload: any) => api.post('/api/payments', payload),
    onSuccess: () => onComplete(),
    onError: (err: any) => setError(err.message || 'Error al procesar el pago'),
  });

  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');

  function handlePay() {
    if (!selectedClientId) { setError('Selecciona un cliente'); return; }
    if (!selectedLocationId) { setError('Selecciona una ubicación'); return; }
    setError(null);
    processPayment.mutate({
      clientId: selectedClientId,
      locationId: selectedLocationId,
      items: items.map((i) => ({
        description: i.name,
        quantity: i.quantity,
        unitPrice: i.price,
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

  // Card renderer
  function renderCard(id: string, name: string, price: number, type: 'service' | 'product', imageUrl?: string) {
    const qty = getCartQty(id);
    const cartItem = items.find((i) => i.id === id);
    const assignedEmp = cartItem?.employeeId ? employees.find((e: any) => e.id === cartItem.employeeId) : null;

    return (
      <div
        key={id}
        className={`relative bg-white rounded-xl border-2 overflow-hidden transition-all hover:shadow-md ${
          qty > 0 ? 'border-[#008080]' : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <button
          onClick={() => { if (qty === 0) addToCart(id, name, price, type, imageUrl); }}
          className="w-full text-left"
        >
          {/* Product image area — 60% height */}
          {type === 'product' && (
            <div className="aspect-[5/3] bg-gray-100 flex items-center justify-center overflow-hidden">
              {imageUrl ? (
                <img src={`${API_URL}${imageUrl}`} alt="" className="w-full h-full object-cover" />
              ) : (
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4" />
                </svg>
              )}
            </div>
          )}
          <div className="p-3">
            <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
            <p className="text-sm font-bold text-[#008080] mt-0.5">{formatCurrency(price)}</p>
          </div>
        </button>

        {/* Assigned employee badge on the card */}
        {type === 'service' && qty > 0 && assignedEmp && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/90 backdrop-blur rounded-full shadow-sm border border-gray-200 px-1.5 py-0.5">
            <div className="w-4 h-4 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-[7px] font-bold text-white" style={{ backgroundColor: assignedEmp.color || '#008080' }}>
              {assignedEmp.avatarUrl ? <img src={`${API_URL}${assignedEmp.avatarUrl}`} alt="" className="w-full h-full object-cover" /> : <>{assignedEmp.firstName[0]}</>}
            </div>
            <span className="text-[10px] text-gray-700 font-medium">{assignedEmp.firstName}</span>
          </div>
        )}

        {/* Quantity control */}
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

  // ─── STEP 1: Catalog ───
  if (step === 'catalog') {
    return (
      <div className="flex flex-col h-full">
        {/* Search */}
        <div className="border-b border-gray-200 px-6 py-3 bg-white">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar servicio o producto..."
              className="w-full text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-2 focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Services by category */}
          {filteredServices.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Servicios</p>
              {(() => {
                const grouped: Record<string, any[]> = {};
                filteredServices.forEach((svc: any) => {
                  const cat = svc.subcategory || svc.category || 'General';
                  if (!grouped[cat]) grouped[cat] = [];
                  grouped[cat].push(svc);
                });
                return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b, 'es')).map(([cat, svcs]) => (
                  <div key={cat} className="mb-4">
                    <p className="text-xs font-bold text-gray-600 mb-2">{cat}</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                      {svcs.map((svc: any) => renderCard(`svc-${svc.id}`, svc.name, Number(svc.price), 'service'))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}

          {/* Products by category */}
          {filteredProducts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Productos</p>
              {(() => {
                const grouped: Record<string, any[]> = {};
                filteredProducts.forEach((prod: any) => {
                  const cat = prod.category || 'General';
                  if (!grouped[cat]) grouped[cat] = [];
                  grouped[cat].push(prod);
                });
                return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b, 'es')).map(([cat, prods]) => (
                  <div key={cat} className="mb-4">
                    <p className="text-xs font-bold text-gray-600 mb-2">{cat}</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                      {prods.map((prod: any) => renderCard(`prod-${prod.id}`, prod.name, Number(prod.price), 'product', prod.imageUrl))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}

          {filteredServices.length === 0 && filteredProducts.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-12">No se encontraron resultados</p>
          )}
        </div>

        {/* Employee picker modal */}
        {employeePickerFor && (
          <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setEmployeePickerFor(null)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm font-semibold text-gray-900 mb-1">¿Quién atiende este servicio?</p>
              <p className="text-xs text-gray-400 mb-4">{items.find((i) => i.id === employeePickerFor)?.name}</p>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {employees.map((emp: any) => (
                  <button
                    key={emp.id}
                    onClick={() => assignEmployee(employeePickerFor, emp.id, `${emp.firstName} ${emp.lastName}`)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: emp.color || '#008080' }}>
                      {emp.avatarUrl ? <img src={`${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" /> : <>{emp.firstName[0]}{emp.lastName[0]}</>}
                    </div>
                    <span className="text-sm text-gray-700">{emp.firstName} {emp.lastName}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setEmployeePickerFor(null)} className="w-full mt-3 py-2 text-xs text-gray-500 hover:text-gray-700">Omitir</button>
            </div>
          </div>
        )}

        {/* Bottom bar */}
        {totalItems > 0 && (
          <div className="border-t border-gray-200 bg-white px-6 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">{totalItems} item{totalItems !== 1 ? 's' : ''}</p>
              <p className="text-xs text-gray-500">{formatCurrency(subtotal)}</p>
            </div>
            <button onClick={() => setStep('review')} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#008080' }}>
              Continuar
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── STEP 2: Review ───
  if (step === 'review') {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-gray-200 px-6 py-3 bg-white flex items-center gap-3">
          <button onClick={() => setStep('catalog')} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </button>
          <h3 className="text-sm font-semibold text-gray-900">Revisar pedido</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Items */}
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-gray-400">{formatCurrency(item.price)} c/u</p>
                    {item.employeeName && (
                      <span className="text-[10px] text-[#008080] bg-teal-50 px-1.5 py-0.5 rounded-full">{item.employeeName}</span>
                    )}
                    {item.type === 'service' && !item.employeeName && (
                      <button onClick={() => setEmployeePickerFor(item.id)} className="text-[10px] text-gray-400 hover:text-[#008080]">+ Asignar empleado</button>
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

          {/* Client & Location */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cliente *</label>
              <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} className="input-field">
                <option value="">Seleccionar cliente...</option>
                {clients.map((c: any) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ubicación *</label>
              <select value={selectedLocationId} onChange={(e) => setSelectedLocationId(e.target.value)} className="input-field">
                <option value="">Seleccionar...</option>
                {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>

          {/* Discount & tip */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Descuento</label>
              <div className="flex gap-2">
                <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} min="0" className="input-field flex-1" placeholder="0" />
                <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                  <button onClick={() => setDiscountType('amount')} className={`px-3 py-2 text-sm ${discountType === 'amount' ? 'bg-[#008080] text-white' : 'bg-white text-gray-700'}`}>$</button>
                  <button onClick={() => setDiscountType('percent')} className={`px-3 py-2 text-sm border-l border-gray-300 ${discountType === 'percent' ? 'bg-[#008080] text-white' : 'bg-white text-gray-700'}`}>%</button>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Propina</label>
              <input type="number" value={tip} onChange={(e) => setTip(e.target.value)} min="0" className="input-field" placeholder="0" />
            </div>
          </div>

          {/* Phone */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono para recibo (opcional)</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field" placeholder="+52 000 000 0000" />
          </div>

          {/* Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-600">Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
              {discountAmount > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">Descuento</span><span className="font-medium text-green-600">-{formatCurrency(discountAmount)}</span></div>}
              {tipAmount > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">Propina</span><span className="font-medium">{formatCurrency(tipAmount)}</span></div>}
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-xl text-[#008080]">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Employee picker modal (also available in review) */}
        {employeePickerFor && (
          <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setEmployeePickerFor(null)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm font-semibold text-gray-900 mb-1">¿Quién atiende este servicio?</p>
              <p className="text-xs text-gray-400 mb-4">{items.find((i) => i.id === employeePickerFor)?.name}</p>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {employees.map((emp: any) => (
                  <button
                    key={emp.id}
                    onClick={() => assignEmployee(employeePickerFor, emp.id, `${emp.firstName} ${emp.lastName}`)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: emp.color || '#008080' }}>
                      {emp.avatarUrl ? <img src={`${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" /> : <>{emp.firstName[0]}{emp.lastName[0]}</>}
                    </div>
                    <span className="text-sm text-gray-700">{emp.firstName} {emp.lastName}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setEmployeePickerFor(null)} className="w-full mt-3 py-2 text-xs text-gray-500 hover:text-gray-700">Omitir</button>
            </div>
          </div>
        )}

        <div className="border-t border-gray-200 bg-white px-6 py-3">
          <button onClick={() => setStep('pay')} className="w-full py-3 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#008080' }}>
            Continuar al pago
          </button>
        </div>
      </div>
    );
  }

  // ─── STEP 3: Pay ───
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gray-200 px-6 py-3 bg-white flex items-center gap-3">
        <button onClick={() => setStep('review')} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <h3 className="text-sm font-semibold text-gray-900">Método de pago</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
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

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-400 uppercase mb-3">Resumen del cobro</p>
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

      <div className="border-t border-gray-200 bg-white px-6 py-4">
        <button onClick={handlePay} disabled={processPayment.isPending}
          className="w-full py-4 rounded-xl text-base font-bold text-white transition-colors disabled:opacity-50" style={{ backgroundColor: '#008080' }}>
          {processPayment.isPending ? 'Procesando...' : `Cobrar ${formatCurrency(total)}`}
        </button>
      </div>
    </div>
  );
}

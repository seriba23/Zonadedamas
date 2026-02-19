'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Service {
  id: string;
  name: string;
  price: number;
}

type PaymentMethod = 'cash' | 'card' | 'transfer';

interface PosCheckoutProps {
  appointmentId?: string;
  clientId?: string;
  onComplete: () => void;
}

export function PosCheckout({
  appointmentId,
  clientId,
  onComplete,
}: PosCheckoutProps) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<string>('0');
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>(
    'amount',
  );
  const [tip, setTip] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  const TAX_RATE = 0.18; // 18% ITBIS for Dominican Republic

  // Fetch appointment items if appointmentId provided
  const { data: appointmentData } = useQuery({
    queryKey: ['appointment-pos', appointmentId],
    queryFn: () =>
      api.get<{
        data: {
          id: string;
          items?: Array<{ id: string; service?: { name: string }; price: number }>;
        };
      }>(`/api/appointments/${appointmentId}`),
    enabled: !!appointmentId,
    onSuccess(res) {
      if (res.data.items && items.length === 0) {
        const cartItems = res.data.items.map((item, idx) => ({
          id: `item-${idx}`,
          name: item.service?.name || 'Servicio',
          price: item.price,
          quantity: 1,
        }));
        setItems(cartItems);
      }
    },
  } as Parameters<typeof useQuery>[0]);

  const { data: servicesData } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get<{ data: Service[] }>('/api/services'),
  });

  const services = servicesData?.data || [];

  const processPaymentMutation = useMutation({
    mutationFn: (payload: {
      appointmentId?: string;
      clientId?: string;
      items: CartItem[];
      subtotal: number;
      discountAmount: number;
      tip: number;
      tax: number;
      total: number;
      method: PaymentMethod;
    }) => api.post('/api/payments', payload),
    onSuccess: () => {
      onComplete();
    },
    onError: (err: { message?: string }) => {
      setError(err.message || 'Error al procesar el pago');
    },
  });

  function addItem() {
    if (!newItemName.trim() || !newItemPrice) return;
    const newItem: CartItem = {
      id: `manual-${Date.now()}`,
      name: newItemName,
      price: parseFloat(newItemPrice),
      quantity: 1,
    };
    setItems((prev) => [...prev, newItem]);
    setNewItemName('');
    setNewItemPrice('');
    setShowAddItem(false);
  }

  function addServiceToCart(service: Service) {
    const existing = items.find((i) => i.id === `svc-${service.id}`);
    if (existing) {
      updateQuantity(existing.id, existing.quantity + 1);
    } else {
      setItems((prev) => [
        ...prev,
        { id: `svc-${service.id}`, name: service.name, price: service.price, quantity: 1 },
      ]);
    }
  }

  function updateQuantity(id: string, qty: number) {
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    } else {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, quantity: qty } : i)),
      );
    }
  }

  const subtotal = items.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0,
  );

  const discountAmount =
    discountType === 'percent'
      ? subtotal * (parseFloat(discount) / 100)
      : parseFloat(discount) || 0;

  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const tipAmount = parseFloat(tip) || 0;
  const taxAmount = afterDiscount * TAX_RATE;
  const total = afterDiscount + tipAmount + taxAmount;

  function handleProcessPayment() {
    if (items.length === 0) {
      setError('Agrega al menos un servicio o producto');
      return;
    }
    setError(null);
    processPaymentMutation.mutate({
      appointmentId,
      clientId,
      items,
      subtotal,
      discountAmount,
      tip: tipAmount,
      tax: taxAmount,
      total,
      method: paymentMethod,
    });
  }

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex-1 overflow-y-auto space-y-4">
        {/* Items list */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Servicios y productos</h3>
            <button
              onClick={() => setShowAddItem(!showAddItem)}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              + Agregar ítem
            </button>
          </div>

          {/* Add item form */}
          {showAddItem && (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 mb-3">
              <p className="text-sm font-medium text-gray-700 mb-3">
                Agregar ítem manual
              </p>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Nombre del ítem"
                  className="input-field flex-1"
                />
                <input
                  type="number"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  placeholder="Precio"
                  className="input-field w-28"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={addItem} className="btn-primary text-sm flex-1">
                  Agregar
                </button>
                <button
                  onClick={() => setShowAddItem(false)}
                  className="btn-secondary text-sm"
                >
                  Cancelar
                </button>
              </div>

              {/* Quick add from services */}
              {services.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-2">
                    Agregar servicio existente:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {services.slice(0, 8).map((s) => (
                      <button
                        key={s.id}
                        onClick={() => addServiceToCart(s)}
                        className="text-xs bg-white border border-gray-300 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cart items */}
          {items.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
              <p className="text-sm text-gray-400">No hay ítems en el carrito</p>
              <button
                onClick={() => setShowAddItem(true)}
                className="mt-2 text-sm text-primary-600 hover:text-primary-700"
              >
                Agregar servicio
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatCurrency(item.price)} c/u
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 text-gray-600"
                    >
                      -
                    </button>
                    <span className="text-sm font-medium w-6 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 text-gray-600"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 w-20 text-right">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Discount */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-700">Ajustes</h4>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Descuento
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                min="0"
                className="input-field flex-1"
                placeholder="0"
              />
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                <button
                  onClick={() => setDiscountType('amount')}
                  className={`px-3 py-2 text-sm ${discountType === 'amount' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  RD$
                </button>
                <button
                  onClick={() => setDiscountType('percent')}
                  className={`px-3 py-2 text-sm border-l border-gray-300 ${discountType === 'percent' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  %
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Propina
            </label>
            <input
              type="number"
              value={tip}
              onChange={(e) => setTip(e.target.value)}
              min="0"
              className="input-field"
              placeholder="0"
            />
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Resumen</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Descuento</span>
                <span className="font-medium text-green-600">
                  -{formatCurrency(discountAmount)}
                </span>
              </div>
            )}
            {tipAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Propina</span>
                <span className="font-medium">{formatCurrency(tipAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">ITBIS (18%)</span>
              <span className="font-medium">{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="font-bold text-gray-900">Total</span>
              <span className="font-bold text-xl text-primary-600">
                {formatCurrency(total)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment method + process button */}
      <div className="pt-4 space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">
            Método de pago
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { value: 'cash', label: 'Efectivo', icon: '💵' },
                { value: 'card', label: 'Tarjeta', icon: '💳' },
                { value: 'transfer', label: 'Transferencia', icon: '🏦' },
              ] as Array<{ value: PaymentMethod; label: string; icon: string }>
            ).map(({ value, label, icon }) => (
              <button
                key={value}
                onClick={() => setPaymentMethod(value)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all ${
                  paymentMethod === value
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span className="text-xl">{icon}</span>
                <span
                  className={`text-xs font-medium ${paymentMethod === value ? 'text-primary-700' : 'text-gray-600'}`}
                >
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleProcessPayment}
          disabled={processPaymentMutation.isPending || items.length === 0}
          className="btn-primary w-full py-3 text-base"
        >
          {processPaymentMutation.isPending
            ? 'Procesando...'
            : `Cobrar ${formatCurrency(total)}`}
        </button>
      </div>
    </div>
  );
}

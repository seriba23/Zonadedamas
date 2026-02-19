'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Drawer } from '@/components/ui/drawer';
import { AppointmentStatusBadge } from '@/components/ui/badge';
import { formatDate, formatCurrency, formatTime } from '@/lib/utils';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  notes?: string;
  tags?: Array<{ id: string; name: string; color: string }>;
  createdAt: string;
}

interface Appointment {
  id: string;
  startTime: string;
  status: string;
  items?: Array<{ service?: { name: string }; price: number }>;
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  createdAt: string;
  status: string;
}

type Tab = 'details' | 'appointments' | 'payments';

interface ClientDrawerProps {
  clientId: string | null;
  onClose: () => void;
}

export function ClientDrawer({ clientId, onClose }: ClientDrawerProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [isEditing, setIsEditing] = useState(!clientId);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: '',
  });
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: clientData, isLoading } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => api.get<{ data: Client }>(`/api/clients/${clientId}`),
    enabled: !!clientId,
    onSuccess(res) {
      const c = res.data;
      setForm({
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email || '',
        phone: c.phone || '',
        notes: c.notes || '',
      });
    },
  } as Parameters<typeof useQuery>[0]);

  const { data: appointmentsData } = useQuery({
    queryKey: ['client-appointments', clientId],
    queryFn: () =>
      api.get<{ data: Appointment[] }>(
        `/api/appointments?clientId=${clientId}&perPage=20`,
      ),
    enabled: !!clientId && activeTab === 'appointments',
  });

  const { data: paymentsData } = useQuery({
    queryKey: ['client-payments', clientId],
    queryFn: () =>
      api.get<{ data: Payment[] }>(`/api/payments?clientId=${clientId}`),
    enabled: !!clientId && activeTab === 'payments',
  });

  const saveMutation = useMutation({
    mutationFn: (payload: typeof form) => {
      if (clientId) {
        return api.put(`/api/clients/${clientId}`, payload);
      }
      return api.post('/api/clients', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      setIsEditing(false);
      setSaveError(null);
      if (!clientId) onClose();
    },
    onError: (err: { message?: string }) => {
      setSaveError(err.message || 'Error al guardar el cliente');
    },
  });

  const client = clientData?.data;
  const appointments = appointmentsData?.data || [];
  const payments = paymentsData?.data || [];

  const title = clientId
    ? client
      ? `${client.firstName} ${client.lastName}`
      : 'Cargando...'
    : 'Nuevo Cliente';

  const tabs: { id: Tab; label: string }[] = clientId
    ? [
        { id: 'details', label: 'Detalles' },
        { id: 'appointments', label: 'Citas' },
        { id: 'payments', label: 'Pagos' },
      ]
    : [{ id: 'details', label: 'Detalles' }];

  return (
    <Drawer title={title} onClose={onClose} width="md">
      {/* Tabs */}
      {clientId && (
        <div className="flex border-b border-gray-200 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="p-6">
        {/* Details tab */}
        {activeTab === 'details' && (
          <div>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : isEditing || !clientId ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveMutation.mutate(form);
                }}
                className="space-y-4"
              >
                {saveError && (
                  <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                    {saveError}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, firstName: e.target.value }))
                      }
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Apellido *
                    </label>
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, lastName: e.target.value }))
                      }
                      className="input-field"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    className="input-field resize-none"
                    rows={3}
                  />
                </div>
                <div className="flex gap-3">
                  {clientId && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="btn-secondary flex-1"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={saveMutation.isPending}
                    className="btn-primary flex-1"
                  >
                    {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            ) : (
              client && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xl font-bold">
                        {client.firstName.charAt(0)}
                        {client.lastName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {client.firstName} {client.lastName}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Cliente desde {formatDate(client.createdAt)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="btn-secondary text-sm"
                    >
                      Editar
                    </button>
                  </div>

                  <div className="space-y-3 pt-2">
                    {client.email && (
                      <div className="flex items-center gap-3">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm text-gray-700">{client.email}</span>
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-3">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span className="text-sm text-gray-700">{client.phone}</span>
                      </div>
                    )}
                  </div>

                  {client.tags && client.tags.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Tags
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {client.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: tag.color + '20',
                              color: tag.color,
                            }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {client.notes && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Notas
                      </p>
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                        {client.notes}
                      </p>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}

        {/* Appointments tab */}
        {activeTab === 'appointments' && (
          <div className="space-y-3">
            {appointments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                No hay citas registradas
              </p>
            ) : (
              appointments.map((apt) => (
                <div
                  key={apt.id}
                  className="p-4 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(apt.startTime)},{' '}
                      {formatTime(
                        new Date(apt.startTime).toTimeString().slice(0, 5),
                      )}
                    </p>
                    <AppointmentStatusBadge status={apt.status} />
                  </div>
                  {apt.items && apt.items.length > 0 && (
                    <p className="text-xs text-gray-500">
                      {apt.items
                        .map((i) => i.service?.name)
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Payments tab */}
        {activeTab === 'payments' && (
          <div className="space-y-3">
            {payments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                No hay pagos registrados
              </p>
            ) : (
              payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(payment.amount)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {payment.method} · {formatDate(payment.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      payment.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {payment.status === 'completed' ? 'Pagado' : payment.status}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}

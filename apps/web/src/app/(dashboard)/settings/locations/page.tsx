'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/hooks/use-auth';

interface Location {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isActive: boolean;
}

interface AddressFields {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface LocationForm {
  name: string;
  addressFields: AddressFields;
  phone: string;
  email: string;
}

const EMPTY_ADDRESS: AddressFields = { street: '', city: '', state: '', postalCode: '', country: '' };

function buildFullAddress(f: AddressFields): string {
  return [f.street, f.city, f.state, f.postalCode, f.country].filter(Boolean).join(', ');
}

function parseAddress(addr: string): AddressFields {
  const parts = addr.split(',').map((s) => s.trim());
  return {
    street: parts[0] || '',
    city: parts[1] || '',
    state: parts[2] || '',
    postalCode: parts[3] || '',
    country: parts[4] || '',
  };
}

// Forward-geocode full address → lat/lng using Nominatim (no API key needed)
async function forwardGeocode(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!address.trim()) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(address)}&limit=1&accept-language=es`,
      { headers: { 'User-Agent': 'Siliba/1.0' } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.length) return null;
    return { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) };
  } catch {
    return null;
  }
}

function emptyForm(adminEmail: string): LocationForm {
  return { name: '', addressFields: EMPTY_ADDRESS, phone: '', email: adminEmail };
}

export default function LocationsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const adminEmail = user?.email || '';

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState<LocationForm>(emptyForm(adminEmail));
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (adminEmail && !showModal) {
      setForm((prev) => ({ ...prev, email: prev.email || adminEmail }));
    }
  }, [adminEmail, showModal]);

  const { data, isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.get<{ data: Location[] }>('/api/tenants/locations'),
  });
  const locations: Location[] = (data as any)?.data || [];

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/api/tenants/locations', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['locations'] }); closeModal(); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.put(`/api/tenants/locations/${id}`, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['locations'] }); closeModal(); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tenants/locations/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['locations'] }); setDeleteConfirm(null); },
  });

  function openCreate() { setEditing(null); setForm(emptyForm(adminEmail)); setShowModal(true); }
  function openEdit(loc: Location) {
    setEditing(loc);
    setForm({
      name: loc.name,
      addressFields: loc.address ? parseAddress(loc.address) : EMPTY_ADDRESS,
      phone: loc.phone || '',
      email: loc.email || adminEmail,
    });
    setShowModal(true);
  }
  function closeModal() { setShowModal(false); setEditing(null); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const fullAddress = buildFullAddress(form.addressFields);
    // Auto-geocode the address silently
    const coords = await forwardGeocode(fullAddress);
    const payload = {
      name: form.name,
      address: fullAddress,
      phone: form.phone || undefined,
      email: form.email || undefined,
      latitude: coords?.lat ?? undefined,
      longitude: coords?.lng ?? undefined,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, body: payload });
    } else {
      createMutation.mutate(payload);
    }
    setSaving(false);
  }

  const isPending = saving || createMutation.isPending || updateMutation.isPending;

  const setAddr = (field: keyof AddressFields, value: string) =>
    setForm((prev) => ({ ...prev, addressFields: { ...prev.addressFields, [field]: value } }));

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sucursales</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gestiona las ubicaciones de tu negocio. Cada sucursal aparece en el marketplace.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ backgroundColor: '#008080' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nueva sucursal
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#008080', borderTopColor: 'transparent' }} />
        </div>
      ) : locations.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#e0f2f1' }}>
            <svg className="w-8 h-8" style={{ color: '#008080' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">Sin sucursales</h3>
          <p className="text-sm text-gray-500 mb-5">Agrega la primera ubicación de tu negocio.</p>
          <button onClick={openCreate} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#008080' }}>
            Agregar sucursal
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {locations.map((loc) => (
            <div key={loc.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start gap-4 shadow-sm">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#e0f2f1' }}>
                <svg className="w-5 h-5" style={{ color: '#008080' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{loc.name}</p>
                {loc.address && <p className="text-sm text-gray-500 mt-0.5 truncate">{loc.address}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                  {loc.phone && <span className="text-xs text-gray-400">{loc.phone}</span>}
                  {loc.email && <span className="text-xs text-gray-400">{loc.email}</span>}
                  {loc.latitude && loc.longitude && (
                    <span className="text-xs font-medium" style={{ color: '#008080' }}>📍 Geolocalización activa</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => openEdit(loc)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Editar">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                  </svg>
                </button>
                <button onClick={() => setDeleteConfirm(loc.id)} className="p-2 rounded-lg hover:bg-red-50 transition-colors" title="Eliminar">
                  <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto" onClick={closeModal}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl my-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-5">
                {editing ? 'Editar sucursal' : 'Nueva sucursal'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Nombre de la sucursal <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ej: Sucursal Centro"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                    required
                  />
                </div>

                {/* Address fields */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Dirección</p>
                  <div>
                    <input
                      type="text"
                      value={form.addressFields.street}
                      onChange={(e) => setAddr('street', e.target.value)}
                      placeholder="Calle y número"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={form.addressFields.city}
                      onChange={(e) => setAddr('city', e.target.value)}
                      placeholder="Ciudad"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                    />
                    <input
                      type="text"
                      value={form.addressFields.state}
                      onChange={(e) => setAddr('state', e.target.value)}
                      placeholder="Estado / Provincia"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={form.addressFields.postalCode}
                      onChange={(e) => setAddr('postalCode', e.target.value)}
                      placeholder="Código postal"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                    />
                    <input
                      type="text"
                      value={form.addressFields.country}
                      onChange={(e) => setAddr('country', e.target.value)}
                      placeholder="País"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+52 55 1234 5678"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email de contacto
                    <span className="text-xs text-gray-400 font-normal ml-1.5">(compartido entre sucursales)</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeModal} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || !form.name.trim()}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                    style={{ backgroundColor: '#008080' }}
                  >
                    {isPending ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear sucursal'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-1">¿Eliminar sucursal?</h3>
            <p className="text-sm text-gray-500 text-center mb-5">Las citas y empleados asociados no se eliminarán.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600">Cancelar</button>
              <button onClick={() => deleteMutation.mutate(deleteConfirm)} disabled={deleteMutation.isPending} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-60">
                {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

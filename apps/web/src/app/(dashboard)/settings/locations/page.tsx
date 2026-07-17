'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { showSaveSuccess } from '@/lib/save-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { CoverageAreasEditor } from '@/components/settings/coverage-areas-editor';
import {
  AddressFields,
  emptyAddress,
  parseAddress,
  serializeAddress,
  validateAddress,
  type AddressValue,
} from '@/components/ui/address-fields';
import { forwardGeocode, type GeocodeHit } from '@/lib/geocode';

// Leaflet usa window — solo cliente.
const LocationMapPicker = dynamic(
  () => import('@/components/ui/location-map-picker'),
  { ssr: false, loading: () => <div className="h-[280px] rounded-xl bg-gray-100 flex items-center justify-center text-xs text-gray-400">Cargando mapa…</div> },
);

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

interface LocationForm {
  name: string;
  addressFields: AddressValue;
  phone: string;
  email: string;
  // Coords finales que se guardan. El usuario puede arrastrarlas en el mapa
  // para corregir cuando Nominatim geocodifica mal.
  coords: { lat: number; lng: number } | null;
}

function emptyForm(adminEmail: string): LocationForm {
  // Default country MX para que el dropdown de subdivisions/ciudades arranque
  // listo (la mayoría de tenants son MX). Se puede cambiar en el dropdown.
  return { name: '', addressFields: emptyAddress('mx'), phone: '', email: adminEmail, coords: null };
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
  // Sucursal cuyo editor de "Servicio a domicilio" (áreas de cobertura) está abierto.
  const [coverageLoc, setCoverageLoc] = useState<Location | null>(null);

  useEffect(() => {
    if (adminEmail && !showModal) {
      setForm((prev) => ({ ...prev, email: prev.email || adminEmail }));
    }
  }, [adminEmail, showModal]);

  const { data, isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.get<{ data: Location[] }>('/api/locations'),
  });
  const locations: Location[] = (data as any)?.data || [];

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/api/locations', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['locations'] }); closeModal(); showSaveSuccess(); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.put(`/api/locations/${id}`, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['locations'] }); closeModal(); showSaveSuccess(); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/locations/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['locations'] }); setDeleteConfirm(null); },
  });

  function openCreate() { setEditing(null); setForm(emptyForm(adminEmail)); setShowModal(true); setAddrErrors({}); }
  function openEdit(loc: Location) {
    setEditing(loc);
    setForm({
      name: loc.name,
      // parseAddress intenta reconstruir los campos a partir del string
      // serializado (Calle Num, Colonia, Ciudad, Region, CP, Pais). Si la
      // dirección guardada es del formato viejo, los campos que no matchean
      // quedan vacíos y el usuario puede completar.
      addressFields: loc.address ? parseAddress(loc.address) : emptyAddress('mx'),
      phone: loc.phone || '',
      email: loc.email || adminEmail,
      coords: loc.latitude != null && loc.longitude != null
        ? { lat: Number(loc.latitude), lng: Number(loc.longitude) }
        : null,
    });
    setShowModal(true);
    setAddrErrors({});
  }
  function closeModal() { setShowModal(false); setEditing(null); setAddrErrors({}); }

  const [addrErrors, setAddrErrors] = useState<Partial<Record<keyof AddressValue, string>>>({});
  // Rastrea si el mousedown del clic empezó en el overlay. Sin esto, si el
  // usuario selecciona texto dentro de un input y arrastra el mouse fuera
  // del input, el mouseup cae en el overlay y dispara un click que cierra
  // el modal — perdiendo lo que estaba escribiendo. Solo cerramos si tanto
  // el mousedown COMO el click ocurrieron en el overlay mismo.
  const [downOnOverlay, setDownOnOverlay] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateAddress(form.addressFields);
    if (Object.keys(errs).length > 0) {
      setAddrErrors(errs);
      return;
    }
    setAddrErrors({});
    setSaving(true);
    const fullAddress = serializeAddress(form.addressFields);
    // Coords finales = lo que muestra el pin del mapa. Si por algun motivo
    // sigue null (usuario no toco el mapa ni se geocodifico), intentamos
    // Nominatim como ultimo recurso para no guardar sin coords.
    let coords: { lat: number; lng: number } | null = form.coords;
    if (!coords) {
      const hit = await forwardGeocode(form.addressFields);
      coords = hit ? { lat: hit.lat, lng: hit.lng } : null;
    }
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

  // Geocodifica la direccion actual y mueve el pin a esa sugerencia. Es lo
  // que el usuario pulsa cuando termina de escribir la direccion o cuando
  // siente que el pin quedo en otro lugar.
  const [geocoding, setGeocoding] = useState(false);
  const [geocodePrecision, setGeocodePrecision] = useState<'address' | 'city' | 'unknown' | null>(null);
  async function suggestCoordsFromAddress() {
    setGeocoding(true);
    const hit = await forwardGeocode(form.addressFields);
    setGeocoding(false);
    if (hit) {
      setForm((prev) => ({ ...prev, coords: { lat: hit.lat, lng: hit.lng } }));
      setGeocodePrecision(hit.precision);
    } else {
      setGeocodePrecision(null);
      alert('No se pudo encontrar esa dirección. Arrastra el pin manualmente al lugar exacto.');
    }
  }

  // Auto-geocode la primera vez que la direccion este completa y aun no hay
  // coords (ni del edit ni del usuario). Solo dispara una vez por apertura
  // del modal — despues respeta lo que el usuario arrastre.
  const [autoGeocodedOnce, setAutoGeocodedOnce] = useState(false);
  useEffect(() => {
    if (!showModal) { setAutoGeocodedOnce(false); return; }
    if (autoGeocodedOnce || form.coords) return;
    const a = form.addressFields;
    const complete = a.street && a.city && a.countryCode;
    if (!complete) return;
    const timer = setTimeout(() => {
      suggestCoordsFromAddress();
      setAutoGeocodedOnce(true);
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, form.addressFields.street, form.addressFields.city, form.addressFields.countryCode]);

  const isPending = saving || createMutation.isPending || updateMutation.isPending;

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
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white flex-shrink-0"
          style={{ backgroundColor: '#008080' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.4} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nueva
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
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setCoverageLoc(loc)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Servicio a domicilio">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                  </svg>
                </button>
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

      {/* Editor de áreas de cobertura (servicio a domicilio) */}
      {coverageLoc && (
        <CoverageAreasEditor
          location={{ id: coverageLoc.id, name: coverageLoc.name, latitude: coverageLoc.latitude, longitude: coverageLoc.longitude }}
          onClose={() => setCoverageLoc(null)}
        />
      )}

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto"
          onMouseDown={(e) => setDownOnOverlay(e.target === e.currentTarget)}
          onClick={(e) => {
            if (downOnOverlay && e.target === e.currentTarget) closeModal();
            setDownOnOverlay(false);
          }}
        >
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

                {/* Dirección — mismo bloque reutilizable que el form de cliente:
                    País dropdown, subdivisiones (estado/provincia/departamento)
                    según país, ciudades MX por estado, CP, calle + número y
                    colonia opcional. Se geocodifica al guardar. */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Dirección</p>
                  <AddressFields
                    value={form.addressFields}
                    onChange={(next) => setForm((prev) => ({ ...prev, addressFields: next }))}
                    required
                    errors={addrErrors}
                  />
                </div>

                {/* Mapa con pin arrastrable — el geocoding automatico via
                    Nominatim puede caer a varios km del lugar real. Aqui el
                    dueño verifica visualmente y arrastra el pin al sitio
                    exacto. Lo que se guarda son las coords del pin. */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Ubicación en el mapa</p>

                  {/* CTA grande y llamativo para disparar la búsqueda */}
                  <button
                    type="button"
                    onClick={suggestCoordsFromAddress}
                    disabled={geocoding}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors hover:opacity-90"
                    style={{ backgroundColor: '#008080' }}
                  >
                    {geocoding ? (
                      <>
                        <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        Buscando dirección…
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        {form.coords ? 'Volver a buscar dirección en mapa' : 'Buscar dirección en mapa'}
                      </>
                    )}
                  </button>

                  <LocationMapPicker
                    value={form.coords}
                    onChange={(coords) => { setForm((prev) => ({ ...prev, coords })); setGeocodePrecision('address'); }}
                  />

                  {/* Aviso de precisión: si Nominatim solo pudo ubicar la
                      ciudad, le decimos al usuario que arrastre el pin. */}
                  {form.coords && geocodePrecision === 'city' && (
                    <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                      <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" />
                      </svg>
                      <span>Solo pudimos ubicar la ciudad. <strong>Arrastra el pin al lugar exacto del local</strong> para que tus clientes vean la distancia correcta.</span>
                    </div>
                  )}

                  <p className="text-xs text-gray-500 leading-relaxed">
                    {form.coords
                      ? '✓ Arrastra el pin si la ubicación no es exacta. Estas coordenadas se usarán para calcular la distancia a tus clientes.'
                      : 'Llena al menos calle, ciudad y país y pulsa "Buscar dirección en mapa".'}
                  </p>
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
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
          onMouseDown={(e) => setDownOnOverlay(e.target === e.currentTarget)}
          onClick={(e) => {
            if (downOnOverlay && e.target === e.currentTarget) setDeleteConfirm(null);
            setDownOnOverlay(false);
          }}
        >
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

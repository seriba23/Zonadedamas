'use client';

// ============================================================
// EmployeeHomeServiceContent — "Servicio a domicilio" para el FREELANCER.
// El freelancer no tiene pantalla de "Sucursales", así que aquí toma su única
// ubicación y:
//   1) si aún no tiene coordenadas fijadas, le deja fijarlas en un mapa
//      (con un botón para partir de la dirección de su registro, y pin
//      arrastrable / ajuste manual) — antes esto quedaba bloqueado con un
//      "contacta a soporte" que no llevaba a ningún lado;
//   2) una vez fijadas, abre el mismo editor de áreas de cobertura que el admin.
// ============================================================

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import { showSaveSuccess } from '@/lib/save-toast';
import { CoverageAreasEditor } from './coverage-areas-editor';
import { parseAddress } from '@/components/ui/address-fields';
import { forwardGeocode } from '@/lib/geocode';

// Leaflet usa window — solo cliente.
const LocationMapPicker = dynamic(
  () => import('@/components/ui/location-map-picker'),
  { ssr: false, loading: () => <div className="h-[280px] rounded-xl bg-gray-100 flex items-center justify-center text-xs text-gray-400">Cargando mapa…</div> },
);

interface Loc {
  id: string;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export function EmployeeHomeServiceContent() {
  const [loc, setLoc] = useState<Loc | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false); // editor de zonas de cobertura

  // Coords del pin (estado editable). Se inicializan con las de la ubicación.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  // Muestra el mapa para AJUSTAR una ubicación que ya estaba fijada.
  const [editingLocation, setEditingLocation] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSeeded, setAutoSeeded] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<{ data: Loc[] }>('/api/locations')
      .then((r) => {
        const l = (r.data || [])[0] || null;
        setLoc(l);
        setCoords(
          l && l.latitude != null && l.longitude != null
            ? { lat: Number(l.latitude), lng: Number(l.longitude) }
            : null,
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const hasCoords = loc && loc.latitude != null && loc.longitude != null;
  // Mostramos el mapa cuando falta fijar la ubicación, o cuando el usuario
  // pidió ajustarla explícitamente.
  const showMap = !!loc && (!hasCoords || editingLocation);

  // Geocodifica la dirección del registro y coloca el pin ahí como punto de
  // partida. El usuario puede afinar arrastrando el pin.
  const seedFromAddress = useCallback(async () => {
    if (!loc?.address) return;
    setGeocoding(true);
    const hit = await forwardGeocode(parseAddress(loc.address));
    setGeocoding(false);
    if (hit) {
      setCoords({ lat: hit.lat, lng: hit.lng });
    } else {
      alert('No pudimos ubicar tu dirección automáticamente. Arrastra el pin al lugar exacto.');
    }
  }, [loc]);

  // La primera vez que se muestra el mapa sin coords, intenta partir de la
  // dirección del registro (una sola vez; después respeta lo que arrastre).
  useEffect(() => {
    if (showMap && !coords && loc?.address && !autoSeeded && !geocoding) {
      setAutoSeeded(true);
      seedFromAddress();
    }
  }, [showMap, coords, loc, autoSeeded, geocoding, seedFromAddress]);

  async function saveCoords() {
    if (!loc || !coords) return;
    setSaving(true);
    try {
      await api.put(`/api/locations/${loc.id}`, { latitude: coords.lat, longitude: coords.lng });
      setLoc((prev) => (prev ? { ...prev, latitude: coords.lat, longitude: coords.lng } : prev));
      setEditingLocation(false);
      showSaveSuccess();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="animate-pulse h-32 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-lg mx-auto pb-24 lg:pb-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Servicio a domicilio</h1>
      <p className="text-sm text-gray-500 mb-5">
        Define hasta dónde te desplazas y cuánto cobras según la distancia. Marca cada servicio como "disponible a domicilio" desde tu catálogo.
      </p>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        {!loc ? (
          <p className="text-sm text-gray-500">No encontramos tu ubicación. Contacta a soporte para configurarla.</p>
        ) : showMap ? (
          // ── Fijar / ajustar la ubicación en el mapa ──
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-800">Fija tu ubicación</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Es el punto desde el que se calculan tus zonas de cobertura. Parte de tu dirección y arrastra el pin al lugar exacto.
              </p>
            </div>

            {loc.address && (
              <button
                type="button"
                onClick={seedFromAddress}
                disabled={geocoding}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors hover:opacity-90"
                style={{ backgroundColor: '#008080' }}
              >
                {geocoding ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Buscando tu dirección…
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {coords ? 'Volver a buscar mi dirección' : 'Usar mi dirección de registro'}
                  </>
                )}
              </button>
            )}

            <LocationMapPicker value={coords} onChange={(c) => setCoords(c)} />

            <p className="text-xs text-gray-500 leading-relaxed">
              {coords
                ? '✓ Arrastra el pin si no quedó exacto. Estas coordenadas se usan para calcular la distancia a tus clientes.'
                : loc.address
                  ? 'Pulsa "Usar mi dirección de registro" para colocar el pin, o toca el mapa para fijarlo manualmente.'
                  : 'Toca el mapa para fijar tu ubicación manualmente.'}
            </p>

            <div className="flex gap-3 pt-1">
              {editingLocation && (
                <button
                  type="button"
                  onClick={() => { setEditingLocation(false); load(); }}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              )}
              <button
                type="button"
                onClick={saveCoords}
                disabled={!coords || saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: '#008080' }}
              >
                {saving ? 'Guardando…' : 'Guardar ubicación'}
              </button>
            </div>
          </div>
        ) : (
          // ── Ubicación ya fijada: zonas de cobertura + ajustar ──
          <div className="space-y-3">
            <p className="text-sm text-gray-700">Tu ubicación está fijada. Configura tus zonas de cobertura (anillos con radio y precio) sobre el mapa.</p>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: '#008080' }}
            >
              Configurar zonas de cobertura
            </button>
            <button
              type="button"
              onClick={() => setEditingLocation(true)}
              className="block text-xs font-medium text-[#008080] hover:underline"
            >
              Ajustar mi ubicación en el mapa
            </button>
          </div>
        )}
      </div>

      {open && loc && hasCoords && (
        <CoverageAreasEditor
          location={{ id: loc.id, name: loc.name, latitude: loc.latitude, longitude: loc.longitude }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

'use client';

// ============================================================
// HomeAddressPicker — paso "dirección" del flujo de servicio a domicilio.
// Muestra las direcciones guardadas del cliente + opción de agregar una nueva
// (con mapa). Valida contra las zonas de cobertura del negocio (haversine, en
// vivo): si entra, muestra la zona y el cargo; si no, avisa "fuera de rango" con
// el mapa de zonas y ofrece cambiar de dirección o ir a la sucursal.
// ============================================================

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { marketplaceApi } from '@/lib/marketplace-api';

const LocationMapPicker = dynamic(() => import('@/components/ui/location-map-picker'), { ssr: false });
const CoverageAreaMap = dynamic(() => import('@/components/ui/coverage-area-map'), { ssr: false });

const TEAL = '#008080';

export interface CoverageArea {
  id: string;
  name: string;
  radiusKm: number;
  price: number;
  color: string;
}
export interface HomeServiceInfo {
  location: { lat: number; lng: number };
  areas: CoverageArea[];
}
export interface DeliverySelection {
  address: string;
  lat: number;
  lng: number;
  areaId: string;
  areaName: string;
  fee: number;
}

interface SavedAddress {
  id: string;
  label?: string | null;
  address: string;
  latitude: number;
  longitude: number;
  // true = derivada automáticamente de la dirección del perfil del usuario.
  fromProfile?: boolean;
}

// Distancia en km entre dos puntos (Haversine), misma base que el backend.
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function HomeAddressPicker({
  homeService,
  formatCurrency,
  onConfirm,
  onGoToBranch,
}: {
  homeService: HomeServiceInfo;
  formatCurrency?: (n: number) => string;
  onConfirm: (d: DeliverySelection) => void;
  onGoToBranch: () => void;
}) {
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Formulario de nueva dirección.
  const [newCoords, setNewCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [newAddress, setNewAddress] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const fmt = (n: number) => (formatCurrency ? formatCurrency(n) : `$${n}`);

  async function load() {
    try {
      const r = await marketplaceApi.get<{ data: SavedAddress[] }>('/addresses');
      setAddresses(r.data || []);
    } catch {
      // sin direcciones
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  // Áreas ordenadas por radio ascendente → el primer anillo que contenga el
  // punto es el más pequeño (precio correcto).
  const sortedAreas = [...homeService.areas].sort((a, b) => a.radiusKm - b.radiusKm);
  function evaluate(lat: number, lng: number) {
    const distanceKm = haversineKm(homeService.location.lat, homeService.location.lng, lat, lng);
    const area = sortedAreas.find((a) => distanceKm <= a.radiusKm) || null;
    return { inRange: !!area, area, distanceKm };
  }

  const selected = addresses.find((a) => a.id === selectedId) || null;
  const result = selected ? evaluate(selected.latitude, selected.longitude) : null;

  async function saveNew() {
    if (!newCoords || !newAddress.trim()) return;
    setSaving(true);
    try {
      const r = await marketplaceApi.post<{ data: SavedAddress }>('/addresses', {
        label: newLabel.trim() || undefined,
        address: newAddress.trim(),
        latitude: newCoords.lat,
        longitude: newCoords.lng,
      });
      await load();
      setSelectedId(r.data.id);
      setAdding(false);
      setNewCoords(null);
      setNewAddress('');
      setNewLabel('');
    } catch {
      // error al guardar
    } finally {
      setSaving(false);
    }
  }

  // ── Formulario de nueva dirección ──
  if (adding) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Arrastra el pin a tu ubicación exacta y escribe la dirección.</p>
        <LocationMapPicker
          value={newCoords}
          onChange={setNewCoords}
          defaultCenter={homeService.location}
          height={260}
        />
        {!newCoords && (
          <p className="text-xs text-gray-400">Toca el mapa o arrastra el pin para fijar tu ubicación.</p>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Dirección</label>
          <input
            type="text"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            placeholder="Calle, número, colonia..."
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#008080]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Etiqueta (opcional)</label>
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Casa, Trabajo..."
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#008080]"
          />
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => { setAdding(false); setNewCoords(null); setNewAddress(''); setNewLabel(''); }}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={saveNew}
            disabled={saving || !newCoords || !newAddress.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: TEAL }}
          >
            {saving ? 'Guardando...' : 'Guardar dirección'}
          </button>
        </div>
      </div>
    );
  }

  // ── Lista + validación ──
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-gray-900">¿A dónde vamos?</h3>
        <p className="text-sm text-gray-500">Elige la dirección donde quieres recibir el servicio.</p>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-14 bg-gray-100 rounded-xl" />
          <div className="h-14 bg-gray-100 rounded-xl" />
        </div>
      ) : (
        <>
          {addresses.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-2">Aún no tienes direcciones guardadas.</p>
          )}
          <div className="space-y-2">
            {addresses.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedId(a.id)}
                className={`w-full text-left rounded-xl border p-3 transition-colors ${
                  selectedId === a.id ? 'border-[#008080] bg-teal-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${selectedId === a.id ? 'border-[#008080]' : 'border-gray-300'}`}>
                    {selectedId === a.id && <span className="block w-full h-full rounded-full scale-50" style={{ backgroundColor: TEAL }} />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {a.label && <p className="text-sm font-semibold text-gray-900">{a.label}</p>}
                      {a.fromProfile && (
                        <span className="text-[10px] font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-1.5 py-0.5 leading-none">
                          De tu perfil
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 truncate">{a.address}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full py-2.5 rounded-xl border border-dashed border-gray-300 text-sm font-medium text-[#008080] hover:bg-teal-50 transition-colors"
          >
            + Agregar otra dirección
          </button>
        </>
      )}

      {/* Resultado de la validación */}
      {selected && result && (
        result.inRange && result.area ? (
          <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
            <p className="text-sm font-semibold text-teal-800">¡Sí llegamos! · {result.area.name}</p>
            <p className="text-xs text-teal-700 mt-0.5">
              Cargo por servicio a domicilio: <span className="font-bold">{fmt(result.area.price)}</span>
              {' · '}a {result.distanceKm.toFixed(1)} km
            </p>
            <button
              type="button"
              onClick={() =>
                onConfirm({
                  address: selected.address,
                  lat: selected.latitude,
                  lng: selected.longitude,
                  areaId: result.area!.id,
                  areaName: result.area!.name,
                  fee: result.area!.price,
                })
              }
              className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: TEAL }}
            >
              Usar esta dirección
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-red-700">Esta dirección está fuera del área de servicio</p>
              <p className="text-xs text-red-600 mt-0.5">
                Está a {result.distanceKm.toFixed(1)} km. Elige otra dirección dentro de la zona o agenda en la sucursal.
              </p>
            </div>
            <CoverageAreaMap
              center={homeService.location}
              areas={homeService.areas.map((a) => ({ radiusKm: a.radiusKm, color: a.color, name: a.name }))}
              point={{ lat: selected.latitude, lng: selected.longitude }}
              height={220}
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50"
              >
                Cambiar dirección
              </button>
              <button
                type="button"
                onClick={onGoToBranch}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: TEAL }}
              >
                Ir a la sucursal
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

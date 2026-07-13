'use client';

// ============================================================
// CoverageAreasEditor — módulo "Servicio a domicilio" de una sucursal.
// Modal completo: el MAPA queda FIJO arriba y debajo, en un área que scrollea,
// las zonas como tarjetas COLAPSABLES (clic para abrir/cerrar). Un ⓘ junto al
// título abre un onboarding que explica la sección.
// Reutilizable por el panel del admin (Sucursales) y el portal del freelancer.
// ============================================================

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Modal } from '@/components/ui/modal';
import { OnboardingCarousel, type OnboardingSlide } from '@/components/ui/onboarding-carousel';
import { api } from '@/lib/api';
import { showSaveSuccess } from '@/lib/save-toast';

// El mapa usa Leaflet (window), así que se importa solo en cliente.
const CoverageAreaMap = dynamic(() => import('@/components/ui/coverage-area-map'), { ssr: false });

// Paleta de colores para distinguir zonas (sin ámbar/naranja, según el proyecto).
const PALETTE = ['#008080', '#2563eb', '#7c3aed', '#16a34a', '#db2777', '#475569'];

// Ilustración del onboarding: anillos concéntricos de colores + el pin (teal) del
// negocio en el centro. Explica visualmente qué es una zona de cobertura.
function CoverageIllustration() {
  return (
    <svg viewBox="0 0 140 140" className="w-32 h-32">
      <circle cx="70" cy="72" r="56" fill="#7c3aed" fillOpacity="0.08" stroke="#7c3aed" strokeOpacity="0.5" strokeWidth="2" />
      <circle cx="70" cy="72" r="40" fill="#2563eb" fillOpacity="0.10" stroke="#2563eb" strokeOpacity="0.6" strokeWidth="2" />
      <circle cx="70" cy="72" r="24" fill="#008080" fillOpacity="0.12" stroke="#008080" strokeOpacity="0.7" strokeWidth="2" />
      {/* Pin del negocio en el centro (mismo teal que en el mapa). */}
      <g transform="translate(58, 40)">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 8.4 12 19.5 12 19.5S24 20.4 24 12C24 5.37 18.63 0 12 0z" fill="#008080" />
        <circle cx="12" cy="12" r="4.5" fill="#fff" />
      </g>
    </svg>
  );
}

// Ilustración: mini "tarjeta de servicio" con el interruptor "A domicilio"
// ENCENDIDO (teal), igual que se ve en la sección Servicios. Ayuda a reconocerlo.
function ServiceToggleIllustration() {
  return (
    <div className="w-56 rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#e0f2f1' }}>
          <svg className="w-4 h-4" style={{ color: '#008080' }} fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="h-2.5 w-24 bg-gray-200 rounded-full" />
          <div className="h-2 w-14 bg-gray-100 rounded-full mt-1.5" />
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: '#e0f2f1' }}>
        <span className="text-xs font-semibold" style={{ color: '#008080' }}>A domicilio</span>
        <div className="relative w-9 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: '#008080' }}>
          <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-white shadow" />
        </div>
      </div>
    </div>
  );
}

const HELP_SLIDES: OnboardingSlide[] = [
  {
    illustration: <CoverageIllustration />,
    title: 'Servicio a domicilio',
    text: 'Atiende a tus clientes en su domicilio. Defines zonas de cobertura —anillos alrededor de tu negocio— y a domicilio solo se puede reservar dentro de ellas.',
  },
  {
    illustration: <ServiceToggleIllustration />,
    title: 'Actívalo en cada servicio',
    text: 'Solo se puede reservar a domicilio los servicios que marques como “A domicilio” en la sección Servicios. Enciende ese interruptor en cada servicio que puedas hacer fuera del local.',
  },
  {
    icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z',
    title: 'Radio y precio por zona',
    text: 'Cada zona tiene un radio máximo (en km desde tu negocio) y un precio que se suma a la cita. El cliente paga el precio de la zona más pequeña que lo contenga.',
  },
  {
    icon: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
    title: 'Colores en el mapa',
    text: 'El color identifica cada zona en el mapa. El pin verde es tu negocio; los círculos de colores son tus zonas de cobertura.',
  },
];

interface LocationLite {
  id: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
}

// Fila editable (radio/precio como texto para poder borrarlos al escribir). uid:
// identificador estable en cliente para el estado de "abierta/cerrada".
interface AreaRow {
  uid: number;
  name: string;
  radiusKm: string;
  price: string;
  color: string;
}

export function CoverageAreasEditor({
  location,
  onClose,
}: {
  location: LocationLite;
  onClose: () => void;
}) {
  const uidRef = useRef(0);
  const [rows, setRows] = useState<AreaRow[]>([]);
  const [openUids, setOpenUids] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const hasCoords = location.latitude != null && location.longitude != null;

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get<{ data: any[] }>(`/api/locations/${location.id}/coverage-areas`);
        const areas = (res.data || []).map((a) => ({
          uid: uidRef.current++,
          name: a.name ?? '',
          radiusKm: a.radiusKm != null ? String(a.radiusKm) : '',
          price: a.price != null ? String(Number(a.price)) : '',
          color: a.color || PALETTE[0],
        }));
        setRows(areas);
      } catch {
        // Sin áreas aún: lista vacía.
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [location.id]);

  const setRow = (i: number, patch: Partial<AreaRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addRow = () => {
    // Nuevo anillo: color siguiente de la paleta y un radio algo mayor al último.
    const color = PALETTE[rows.length % PALETTE.length];
    const lastRadius = rows.reduce((m, r) => Math.max(m, Number(r.radiusKm) || 0), 0);
    const uid = uidRef.current++;
    setRows((rs) => [...rs, { uid, name: `Zona ${rs.length + 1}`, radiusKm: String(lastRadius + 3), price: '', color }]);
    // La zona recién creada se abre para poder llenarla.
    setOpenUids((prev) => new Set(prev).add(uid));
  };

  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const toggle = (uid: number) =>
    setOpenUids((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });

  // Anillos válidos para el mapa (radio > 0).
  const mapAreas = rows
    .filter((r) => Number(r.radiusKm) > 0)
    .map((r) => ({ radiusKm: Number(r.radiusKm), color: r.color, name: r.name }));

  const handleSave = async () => {
    setError(null);
    for (const r of rows) {
      if (!r.name.trim()) return setError('Cada zona necesita un nombre.');
      if (!(Number(r.radiusKm) > 0)) return setError(`La zona "${r.name}" necesita un radio mayor a 0.`);
      if (r.price === '' || Number(r.price) < 0) return setError(`La zona "${r.name}" necesita un precio válido.`);
    }
    setSaving(true);
    try {
      await api.put(`/api/locations/${location.id}/coverage-areas`, {
        areas: rows.map((r, i) => ({
          name: r.name.trim(),
          radiusKm: Number(r.radiusKm),
          price: Number(r.price),
          color: r.color,
          sortOrder: i,
        })),
      });
      showSaveSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // Botón ⓘ que abre el onboarding (se coloca junto al título del modal).
  const helpButton = hasCoords ? (
    <button
      type="button"
      onClick={() => setShowHelp(true)}
      aria-label="¿Cómo funciona el servicio a domicilio?"
      title="¿Cómo funciona?"
      className="p-1 rounded-lg text-gray-400 hover:text-[#008080] hover:bg-gray-100 transition-colors flex-shrink-0"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
    </button>
  ) : undefined;

  return (
    <Modal
      title={`Servicio a domicilio — ${location.name}`}
      onClose={onClose}
      size="xl"
      titleAccessory={helpButton}
    >
      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-64 bg-gray-200 rounded-xl" />
          <div className="h-20 bg-gray-200 rounded-xl" />
        </div>
      ) : !hasCoords ? (
        <div className="text-center py-10">
          <p className="text-sm text-gray-600 mb-1">Esta sucursal no tiene ubicación en el mapa.</p>
          <p className="text-xs text-gray-400">Primero fija su ubicación (latitud/longitud) al editar la sucursal; las zonas se dibujan alrededor de ese punto.</p>
        </div>
      ) : (
        // Columna acotada: mapa fijo arriba, zonas con scroll propio, footer fijo.
        <div className="flex flex-col" style={{ maxHeight: '72vh' }}>
          {/* ── Mapa FIJO (no scrollea) ── */}
          <div className="flex-shrink-0">
            <CoverageAreaMap
              center={{ lat: location.latitude as number, lng: location.longitude as number }}
              areas={mapAreas}
              height={260}
            />
          </div>

          {/* ── Zonas (colapsables) — ÚNICA parte que scrollea ── */}
          <div className="flex-1 min-h-0 overflow-y-auto mt-4 pr-1">
            <div className="space-y-2">
              {rows.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Aún no hay zonas. Agrega la primera para empezar.</p>
              )}

              {rows.map((r, i) => {
                const open = openUids.has(r.uid);
                return (
                  <div key={r.uid} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {/* Cabecera compacta (clic para abrir/cerrar) */}
                    <button
                      type="button"
                      onClick={() => toggle(r.uid)}
                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <span className="w-4 h-4 rounded-full flex-shrink-0 border border-black/10" style={{ backgroundColor: r.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{r.name.trim() || 'Zona sin nombre'}</p>
                        <p className="text-xs text-gray-400">
                          {r.radiusKm ? `${r.radiusKm} km` : 'sin radio'}
                          {r.price !== '' ? ` · $${r.price}` : ''}
                        </p>
                      </div>
                      {/* Eliminar (no abre/cierra) */}
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); removeRow(i); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); removeRow(i); } }}
                        className="text-gray-300 hover:text-red-500 flex-shrink-0 p-1 -m-1"
                        aria-label="Quitar zona"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </span>
                      {/* Chevron */}
                      <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                    </button>

                    {/* Detalle editable (solo cuando está abierta) */}
                    {open && (
                      <div className="px-3 pb-3 pt-3 border-t border-gray-100">
                        {/* Color */}
                        <div className="flex gap-1.5 mb-3">
                          {PALETTE.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setRow(i, { color: c })}
                              className={`w-6 h-6 rounded-full border-2 transition-transform ${r.color === c ? 'scale-110 border-gray-700' : 'border-white'}`}
                              style={{ backgroundColor: c }}
                              aria-label={`Color ${c}`}
                            />
                          ))}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[11px] font-medium text-gray-500 mb-1">Nombre</label>
                            <input
                              type="text"
                              value={r.name}
                              onChange={(e) => setRow(i, { name: e.target.value })}
                              placeholder="Ej. Zona centro"
                              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#008080]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-gray-500 mb-1">Radio máx.</label>
                            <div className="relative">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={r.radiusKm}
                                onChange={(e) => setRow(i, { radiusKm: e.target.value.replace(/[^0-9.]/g, '') })}
                                placeholder="5"
                                className="w-full text-sm border border-gray-200 rounded-lg pl-2.5 pr-9 py-1.5 focus:outline-none focus:border-[#008080]"
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">km</span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-gray-500 mb-1">Precio</label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={r.price}
                                onChange={(e) => setRow(i, { price: e.target.value.replace(/[^0-9.]/g, '') })}
                                placeholder="0"
                                className="w-full text-sm border border-gray-200 rounded-lg pl-6 pr-2.5 py-1.5 focus:outline-none focus:border-[#008080]"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={addRow}
                className="w-full py-2.5 rounded-xl border border-dashed border-gray-300 text-sm font-medium text-[#008080] hover:bg-teal-50 transition-colors"
              >
                + Agregar zona
              </button>
            </div>
          </div>

          {/* ── Footer FIJO ── */}
          <div className="flex-shrink-0 pt-3 mt-2 border-t border-gray-100">
            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: '#008080' }}
              >
                {saving ? 'Guardando...' : 'Guardar zonas'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding (ⓘ) — overlay a pantalla completa por encima del modal. */}
      {showHelp && (
        <OnboardingCarousel
          slides={HELP_SLIDES}
          theme="light"
          accent="#008080"
          doneLabel="Entendido"
          onDone={() => setShowHelp(false)}
          onSkip={() => setShowHelp(false)}
        />
      )}
    </Modal>
  );
}

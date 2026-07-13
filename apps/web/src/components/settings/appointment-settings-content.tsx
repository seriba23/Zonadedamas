'use client';

// ============================================================
// AppointmentSettingsContent — políticas de RESERVA de citas del negocio.
// Por ahora: "antelación mínima" (horas mínimas con las que un CLIENTE puede
// reservar). Autocontenido: lee el tenant (GET /api/tenants/current) y guarda
// (PUT /api/tenants/profile). Solo afecta a reservas de cliente
// (marketplace/portal/público); el personal puede crear citas de último momento.
// ============================================================

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { showSaveSuccess } from '@/lib/save-toast';

const TEAL = '#008080';

// Atajos rápidos de antelación (en horas).
const PRESETS: { hours: number; label: string }[] = [
  { hours: 2, label: '2 h' },
  { hours: 12, label: '12 h' },
  { hours: 24, label: '24 h' },
  { hours: 48, label: '48 h' },
  { hours: 72, label: '72 h' },
];

export function AppointmentSettingsContent() {
  // enabled = ¿se exige un mínimo? (equivale a horas > 0).
  const [enabled, setEnabled] = useState(false);
  // Se guarda como texto para poder borrarlo libremente al escribir; se convierte
  // a número al guardar.
  const [hours, setHours] = useState('24');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get<{ data: any }>('/api/tenants/current');
        const t = res.data || {};
        const h = Number(t.minBookingHoursAdvance) || 0;
        setEnabled(h > 0);
        setHours(h > 0 ? String(h) : '24');
      } catch {
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    // Si está desactivado guardamos 0 (sin mínimo). Si está activo, el número
    // introducido (acotado a 1–720; 0 desactivaría, así que forzamos mínimo 1).
    const parsed = Math.max(0, Math.min(720, Math.round(Number(hours) || 0)));
    const value = enabled ? Math.max(1, parsed) : 0;
    setSaving(true);
    try {
      await api.put('/api/tenants/profile', { minBookingHoursAdvance: value });
      showSaveSuccess();
    } catch (err: any) {
      alert(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-40 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Reserva de citas</h1>
      <p className="text-sm text-gray-500 mb-6">
        Controla con cuánta anticipación pueden reservarte tus clientes. No afecta a las citas que tú o tu equipo creen desde el panel (clientes sin cita previa, por teléfono).
      </p>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        {/* Activar antelación mínima */}
        <div className="flex items-center justify-between gap-3 py-1">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">Exigir antelación mínima</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Los clientes no podrán reservar con menos de las horas indicadas de anticipación.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled((v) => !v)}
            className="relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors"
            style={{ backgroundColor: enabled ? TEAL : '#e5e7eb' }}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      <div className={`bg-white rounded-xl border border-gray-200 p-5 mb-6 transition-opacity ${enabled ? '' : 'opacity-50 pointer-events-none'}`}>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Horas mínimas de anticipación</h2>

        {/* Atajos rápidos */}
        <div className="flex flex-wrap gap-2 mb-4">
          {PRESETS.map((p) => {
            const active = Number(hours) === p.hours;
            return (
              <button
                key={p.hours}
                type="button"
                onClick={() => setHours(String(p.hours))}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-[#008080] border-[#008080] text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Valor personalizado */}
        <label className="block text-xs font-medium text-gray-600 mb-1">Personalizado</label>
        <div className="relative w-40">
          <input
            type="text"
            inputMode="numeric"
            value={hours}
            onChange={(e) => setHours(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="24"
            className="w-full pl-3 pr-12 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#008080]/30 focus:border-[#008080]"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">horas</span>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Ejemplo: con <span className="font-medium text-gray-500">24 horas</span>, un cliente que entra hoy al mediodía solo podrá reservar a partir de mañana al mediodía. Máximo 720 horas (30 días).
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: TEAL }}
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

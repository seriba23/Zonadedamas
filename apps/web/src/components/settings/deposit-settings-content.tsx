'use client';

// ============================================================
// DepositSettingsContent — configuración del ANTICIPO (depósito) del negocio.
// Autocontenido: lee el tenant (GET /api/tenants/current) y guarda los campos
// de anticipo (PUT /api/tenants/profile). Se usa tanto en el dashboard del
// admin como en el portal del freelancer (/employee/anticipo).
// ============================================================

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

const TEAL = '#008080';

interface DepositSettings {
  depositEnabled: boolean;
  depositType: 'FIXED' | 'PERCENT';
  // Se guarda como texto para que el campo sea borrable (escribir libremente en
  // celular); se convierte a número al guardar.
  depositValue: string;
}

export function DepositSettingsContent() {
  const [settings, setSettings] = useState<DepositSettings>({
    depositEnabled: false,
    depositType: 'PERCENT',
    depositValue: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get<{ data: any }>('/api/tenants/current');
        const t = res.data || {};
        setSettings({
          depositEnabled: !!t.depositEnabled,
          depositType: (t.depositType === 'FIXED' ? 'FIXED' : 'PERCENT'),
          depositValue: t.depositValue == null ? '' : String(Number(t.depositValue)),
        });
      } catch {
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/api/tenants/profile', {
        depositEnabled: settings.depositEnabled,
        depositType: settings.depositType,
        depositValue: Number(settings.depositValue) || 0,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
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
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  const set = (patch: Partial<DepositSettings>) => setSettings((s) => ({ ...s, ...patch }));

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Anticipo de citas</h1>
      <p className="text-sm text-gray-500 mb-6">
        Exige un anticipo por transferencia para confirmar las citas. La cita queda pendiente hasta que confirmes el anticipo recibido.
      </p>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        {/* Activar anticipo */}
        <div className="flex items-center justify-between gap-3 py-1">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">Exigir anticipo</p>
            <p className="text-xs text-gray-500 mt-0.5">Las nuevas citas nacerán pendientes hasta confirmar el anticipo.</p>
          </div>
          <button
            type="button"
            onClick={() => set({ depositEnabled: !settings.depositEnabled })}
            className="relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors"
            style={{ backgroundColor: settings.depositEnabled ? TEAL : '#e5e7eb' }}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.depositEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      <div className={`bg-white rounded-xl border border-gray-200 p-5 mb-4 transition-opacity ${settings.depositEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Monto del anticipo</h2>
        {/* Tipo: monto fijo o porcentaje */}
        <div className="flex rounded-lg border border-gray-300 overflow-hidden mb-3 max-w-xs">
          {([['PERCENT', 'Porcentaje'], ['FIXED', 'Monto fijo']] as const).map(([key, label], idx) => (
            <button
              key={key}
              type="button"
              onClick={() => set({ depositType: key })}
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${idx > 0 ? 'border-l border-gray-300' : ''} ${
                settings.depositType === key ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {settings.depositType === 'PERCENT' ? 'Porcentaje del total de servicios (%)' : 'Monto fijo'}
        </label>
        <div className="relative w-full">
          {settings.depositType === 'FIXED' && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
          )}
          <input
            type="text"
            inputMode="decimal"
            value={settings.depositValue}
            onChange={(e) => set({ depositValue: e.target.value.replace(/[^0-9.]/g, '') })}
            placeholder="0"
            className={`w-full ${settings.depositType === 'FIXED' ? 'pl-7' : 'pl-3'} pr-8 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#008080]/30 focus:border-[#008080]`}
          />
          {settings.depositType === 'PERCENT' && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Los datos de la transferencia (banco, CLABE, titular) se toman de la configuración de <span className="font-medium text-gray-500">Ventas</span>.
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
        {saved && <span className="text-sm text-green-600 font-medium">Guardado ✓</span>}
      </div>
    </div>
  );
}

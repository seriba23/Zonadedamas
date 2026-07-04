'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { showSaveSuccess } from '@/lib/save-toast';

const TEAL = '#008080';
const TEAL_DARK = '#006666';
const TEAL_LIGHT = '#e0f2f1';

interface ShopSettings {
  shopEnabled: boolean;
  shopPickupEnabled: boolean;
  shopShippingEnabled: boolean;
  shopShippingCost: number | string | null;
  shopPaymentCash: boolean;
  shopPaymentSpei: boolean;
  shopPaymentCard: boolean;
  shopSpeiBankName: string;
  shopSpeiHolderName: string;
  shopSpeiClabe: string;
}

export function ShopSettingsContent() {
  const [settings, setSettings] = useState<ShopSettings>({
    shopEnabled: false,
    shopPickupEnabled: true,
    shopShippingEnabled: false,
    shopShippingCost: '',
    shopPaymentCash: true,
    shopPaymentSpei: false,
    shopPaymentCard: false,
    shopSpeiBankName: '',
    shopSpeiHolderName: '',
    shopSpeiClabe: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get<{ data: ShopSettings }>('/api/tenants/shop-settings');
        setSettings(res.data);
      } catch {
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Normalizamos el costo de envío: '' o null → null; si no, número.
      const payload = {
        ...settings,
        shopShippingCost:
          settings.shopShippingCost === '' || settings.shopShippingCost === null
            ? null
            : Number(settings.shopShippingCost),
      };
      const res = await api.put<{ data: ShopSettings }>('/api/tenants/shop-settings', payload);
      setSettings(res.data);
      showSaveSuccess();
    } catch (err: any) {
      alert(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({ checked, onChange, label, description }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
    description?: string;
  }) => (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
          checked ? '' : 'bg-gray-200'
        }`}
        style={checked ? { backgroundColor: TEAL } : undefined}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );

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

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Tienda</h1>
      <p className="text-sm text-gray-500 mb-6">
        Configura tu tienda de productos para que tus clientes puedan apartarlos desde tu perfil.
      </p>

      {/* Info Banner */}
      <div className="rounded-xl p-4 mb-6 border" style={{ backgroundColor: TEAL_LIGHT, borderColor: `${TEAL}30` }}>
        <div className="flex gap-3">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: TEAL }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          <div>
            <p className="text-sm font-medium" style={{ color: TEAL }}>Siliba no procesa pagos de productos</p>
            <p className="text-xs mt-1" style={{ color: '#555' }}>
              Los clientes apartan productos y pagan directamente a tu negocio al recogerlos o recibirlos.
              Tú controlas los métodos de pago que aceptas.
            </p>
          </div>
        </div>
      </div>

      {/* Main Toggle */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">General</h2>
        <Toggle
          checked={settings.shopEnabled}
          onChange={(v) => setSettings({ ...settings, shopEnabled: v })}
          label="Habilitar tienda"
          description="Muestra la sección de productos en tu perfil del marketplace"
        />
      </div>

      {/* Fulfillment Options */}
      <div className={`bg-white rounded-xl border border-gray-200 p-5 mb-4 transition-opacity ${settings.shopEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Opciones de entrega</h2>
        <Toggle
          checked={settings.shopPickupEnabled}
          onChange={(v) => setSettings({ ...settings, shopPickupEnabled: v })}
          label="Recoger en tienda"
          description="Los clientes recogen su producto en tu local"
        />
        <div className="border-t border-gray-100" />
        <Toggle
          checked={settings.shopShippingEnabled}
          onChange={(v) => setSettings({ ...settings, shopShippingEnabled: v })}
          label="Envio a domicilio"
          description="Ofreces envio a domicilio. El costo es el mismo por pedido, sin importar cuantos productos lleve."
        />
        {settings.shopShippingEnabled && (
          <div className="pl-1 pt-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Costo de envío por pedido (MXN)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={settings.shopShippingCost ?? ''}
              onChange={(e) => setSettings({ ...settings, shopShippingCost: e.target.value })}
              placeholder="Ej: 80"
              className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/20"
            />
            <p className="text-[11px] text-gray-400 mt-1">Se cobra una sola vez por compra a domicilio. Déjalo vacío o en 0 para envío gratis.</p>
          </div>
        )}
      </div>

      {/* Payment Methods */}
      <div className={`bg-white rounded-xl border border-gray-200 p-5 mb-6 transition-opacity ${settings.shopEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Métodos de pago aceptados</h2>
        <p className="text-xs text-gray-500 mb-3">
          Estos son los métodos que tus clientes podrán elegir al apartar un producto.
          El cobro lo realizas tu directamente.
        </p>
        <Toggle
          checked={settings.shopPaymentCash}
          onChange={(v) => setSettings({ ...settings, shopPaymentCash: v })}
          label="Efectivo"
          description="Pago en efectivo al recoger o recibir"
        />
        <div className="border-t border-gray-100" />
        <Toggle
          checked={settings.shopPaymentSpei}
          onChange={(v) => setSettings({ ...settings, shopPaymentSpei: v })}
          label="SPEI / Transferencia"
          description="Transferencia bancaria directa a tu cuenta"
        />
        {/* SPEI Bank Details */}
        {settings.shopPaymentSpei && (
          <div className="mt-3 mb-1 space-y-3 pl-4 border-l-2" style={{ borderColor: `${TEAL}40` }}>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Banco</label>
              <input
                type="text"
                value={settings.shopSpeiBankName}
                onChange={(e) => setSettings({ ...settings, shopSpeiBankName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                placeholder="Ej: BBVA, Banorte, Santander..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Titular de la cuenta</label>
              <input
                type="text"
                value={settings.shopSpeiHolderName}
                onChange={(e) => setSettings({ ...settings, shopSpeiHolderName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                placeholder="Nombre completo del titular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">CLABE interbancaria (18 digitos)</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={18}
                value={settings.shopSpeiClabe}
                onChange={(e) => setSettings({ ...settings, shopSpeiClabe: e.target.value.replace(/\D/g, '').slice(0, 18) })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                placeholder="000000000000000000"
              />
              {settings.shopSpeiClabe && settings.shopSpeiClabe.length !== 18 && (
                <p className="text-xs text-amber-600 mt-1">{settings.shopSpeiClabe.length}/18 digitos</p>
              )}
            </div>
          </div>
        )}
        <div className="border-t border-gray-100" />
        <Toggle
          checked={settings.shopPaymentCard}
          onChange={(v) => setSettings({ ...settings, shopPaymentCard: v })}
          label="Tarjeta"
          description="Cobro con tu terminal punto de venta"
        />
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
        style={{ backgroundColor: saving ? TEAL_DARK : TEAL }}
        onMouseEnter={(e) => { if (!saving) e.currentTarget.style.backgroundColor = TEAL_DARK; }}
        onMouseLeave={(e) => { if (!saving) e.currentTarget.style.backgroundColor = TEAL; }}
      >
        {saving ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </div>
  );
}

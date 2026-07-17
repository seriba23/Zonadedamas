'use client';

// ============================================================
// PaymentMethodsContent — métodos de pago que acepta el negocio (efectivo,
// SPEI/transferencia con datos bancarios, tarjeta con terminal).
//
// Antes vivía DENTRO de la pantalla de Tienda y se deshabilitaba si la tienda
// estaba apagada. Se extrajo aquí para que sea una sección propia,
// independiente de la tienda: un negocio puede aceptar tarjeta/SPEI sin
// activar la tienda. Los mismos campos (shopPayment*/shopSpei*) del tenant
// también los usa el anticipo de citas, que ahora se pueden configurar sin
// depender de la tienda.
//
// Persiste vía el mismo endpoint /api/tenants/shop-settings (update parcial:
// solo enviamos los campos de pago, no tocamos shopEnabled ni entrega).
// ============================================================

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { showSaveSuccess } from '@/lib/save-toast';

const TEAL = '#008080';
const TEAL_DARK = '#006666';

interface PaymentSettings {
  shopPaymentCash: boolean;
  shopPaymentSpei: boolean;
  shopPaymentCard: boolean;
  shopSpeiBankName: string;
  shopSpeiHolderName: string;
  shopSpeiClabe: string;
}

const EMPTY: PaymentSettings = {
  shopPaymentCash: true,
  shopPaymentSpei: false,
  shopPaymentCard: false,
  shopSpeiBankName: '',
  shopSpeiHolderName: '',
  shopSpeiClabe: '',
};

export function PaymentMethodsContent() {
  const [settings, setSettings] = useState<PaymentSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get<{ data: PaymentSettings }>('/api/tenants/shop-settings');
        setSettings({ ...EMPTY, ...res.data });
      } catch {
        /* deja los defaults */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Solo enviamos los campos de pago (update parcial en el backend).
      const payload = {
        shopPaymentCash: settings.shopPaymentCash,
        shopPaymentSpei: settings.shopPaymentSpei,
        shopPaymentCard: settings.shopPaymentCard,
        shopSpeiBankName: settings.shopSpeiBankName,
        shopSpeiHolderName: settings.shopSpeiHolderName,
        shopSpeiClabe: settings.shopSpeiClabe,
      };
      await api.put('/api/tenants/shop-settings', payload);
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
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${checked ? '' : 'bg-gray-200'}`}
        style={checked ? { backgroundColor: TEAL } : undefined}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
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
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Métodos de pago</h1>
      <p className="text-sm text-gray-500 mb-6">
        Define cómo te pagan tus clientes. Aplica a productos de la tienda y al anticipo de citas. El cobro lo realizas tú directamente; Siliba no procesa estos pagos.
      </p>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
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
                <p className="text-xs text-teal-700 mt-1">{settings.shopSpeiClabe.length}/18 digitos</p>
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

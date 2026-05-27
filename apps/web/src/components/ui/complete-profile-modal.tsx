'use client';

import { useState, useEffect } from 'react';
import { marketplaceApi } from '@/lib/marketplace-api';
import { resolveImageUrl } from '@/lib/utils';
import { DatePicker } from './date-picker';
import { AllergiesSelector } from './allergies-selector';
import { AddressFields, emptyAddress, parseAddress, serializeAddress, type AddressValue } from './address-fields';
import { loadCountries } from '@/lib/geo-data';

const TEAL = '#008080';
const TEAL_DARK = '#006666';
const TEAL_LIGHT = '#e0f2f1';

const COUNTRY_CODES = [
  { code: '+52', flag: '🇲🇽', name: 'México' },
  { code: '+1', flag: '🇺🇸', name: 'EE.UU. / Canadá' },
  { code: '+34', flag: '🇪🇸', name: 'España' },
  { code: '+54', flag: '🇦🇷', name: 'Argentina' },
  { code: '+57', flag: '🇨🇴', name: 'Colombia' },
  { code: '+56', flag: '🇨🇱', name: 'Chile' },
  { code: '+51', flag: '🇵🇪', name: 'Perú' },
  { code: '+58', flag: '🇻🇪', name: 'Venezuela' },
  { code: '+593', flag: '🇪🇨', name: 'Ecuador' },
  { code: '+502', flag: '🇬🇹', name: 'Guatemala' },
  { code: '+503', flag: '🇸🇻', name: 'El Salvador' },
  { code: '+504', flag: '🇭🇳', name: 'Honduras' },
  { code: '+505', flag: '🇳🇮', name: 'Nicaragua' },
  { code: '+506', flag: '🇨🇷', name: 'Costa Rica' },
  { code: '+507', flag: '🇵🇦', name: 'Panamá' },
  { code: '+53', flag: '🇨🇺', name: 'Cuba' },
  { code: '+1-809', flag: '🇩🇴', name: 'Rep. Dominicana' },
  { code: '+591', flag: '🇧🇴', name: 'Bolivia' },
  { code: '+595', flag: '🇵🇾', name: 'Paraguay' },
  { code: '+598', flag: '🇺🇾', name: 'Uruguay' },
  { code: '+55', flag: '🇧🇷', name: 'Brasil' },
];

const GENDER_OPTIONS = [
  { value: '', label: 'Selecciona una opción' },
  { value: 'FEMALE', label: 'Femenino' },
  { value: 'MALE', label: 'Masculino' },
  { value: 'NON_BINARY', label: 'No binario' },
  { value: 'PREFER_NOT_SAY', label: 'Prefiero no decir' },
];

interface CompleteProfileModalProps {
  user: {
    firstName?: string | null;
    phone: string | null;
    birthDate?: string | null;
    gender?: string | null;
    allergies?: string | null;
    address?: string | null;
    avatarUrl?: string | null;
  };
  onComplete: () => void;
  onSkip: () => void;
}

export function CompleteProfileModal({ user, onComplete, onSkip }: CompleteProfileModalProps) {
  const [step, setStep] = useState<'welcome' | 'form' | 'thanks'>('welcome');
  const [countryCode, setCountryCode] = useState('+52');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [form, setForm] = useState({
    birthDate: user.birthDate ? user.birthDate.split('T')[0] : '',
    gender: user.gender || '',
    allergies: user.allergies || '',
  });
  const [address, setAddress] = useState<AddressValue>(
    user.address ? parseAddress(user.address) : emptyAddress('mx'),
  );

  // Re-parsear address con countries cargados para resolver countryCode
  // (sino el dropdown queda vacio aunque el cliente tenga direccion guardada).
  useEffect(() => {
    if (!user.address) return;
    loadCountries().then((countries) => {
      setAddress((prev) => {
        // Solo re-parsear si todavia no resolvimos countryCode
        if (prev.countryCode) return prev;
        return parseAddress(user.address!, countries);
      });
    }).catch(() => {});
  }, [user.address]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const initials = `${(user.firstName || '')[0] || ''}`.toUpperCase();
  const avatarUrl = user.avatarUrl ? resolveImageUrl(user.avatarUrl) : null;

  const handleSubmit = async () => {
    if (!user.phone && phoneNumber && phoneNumber.length !== 10) {
      setError('El teléfono debe tener exactamente 10 dígitos.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const fullPhone = phoneNumber ? `${countryCode}${phoneNumber}` : undefined;
      const addressStr = serializeAddress(address);
      await marketplaceApi.put('/auth/profile', {
        phone: fullPhone,
        birthDate: form.birthDate || undefined,
        gender: form.gender || undefined,
        allergies: form.allergies || undefined,
        address: addressStr || undefined,
      });
      setStep('thanks');
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // ── Step 1: Welcome ──────────────────────────────────
  if (step === 'welcome') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-7 text-center" onClick={(e) => e.stopPropagation()}>
          {/* Logo */}
          <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: TEAL }}>
            <span className="text-white text-2xl font-bold">S</span>
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-3">
            ¡Hola{user.firstName ? `, ${user.firstName}` : ''}! Bienvenido a Siliba
          </h1>

          <p className="text-sm text-gray-500 leading-relaxed mb-8">
            Aquí encontrarás servicios de todo tipo con profesionales de verdad que te brindarán la mejor experiencia.
          </p>

          <button
            onClick={() => setStep('form')}
            className="w-full text-white py-3 rounded-xl font-semibold text-sm transition-colors"
            style={{ backgroundColor: TEAL }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = TEAL_DARK)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL)}
          >
            Continuar
          </button>
          <button
            onClick={onSkip}
            className="w-full mt-2 py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Ahora no
          </button>
        </div>
      </div>
    );
  }

  // ── Step 3: Thanks ──────────────────────────────────
  if (step === 'thanks') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-7 text-center" onClick={(e) => e.stopPropagation()}>
          <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: TEAL_LIGHT }}>
            <svg className="w-8 h-8" style={{ color: TEAL }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">¡Perfil completado!</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-8">
            Gracias por completar tu perfil. Ahora podemos ofrecerte una experiencia personalizada y asegurarnos de que cada servicio sea perfecto para ti.
          </p>
          <button
            onClick={onComplete}
            className="w-full text-white py-3 rounded-xl font-semibold text-sm transition-colors"
            style={{ backgroundColor: TEAL }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = TEAL_DARK)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL)}
          >
            ¡Empezar!
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Form ─────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

        {/* Avatar */}
        <div className="flex flex-col items-center mb-5">
          <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center mb-2"
            style={{ backgroundColor: TEAL_LIGHT }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold" style={{ color: TEAL }}>{initials || '?'}</span>
            )}
          </div>
          <h2 className="text-lg font-bold text-gray-900">Completa tu perfil</h2>
          <p className="text-xs text-gray-400 mt-0.5">Estos datos nos ayudan a darte una mejor experiencia</p>
        </div>

        <div className="space-y-4">

          {/* Phone — only if not already provided.
              min-w-0 en el wrapper + flex-shrink en el select para evitar
              que el bloque se desborde del modal en pantallas estrechas.
              El input acepta solo 10 digitos (validacion local MX). */}
          {!user.phone && (
            <div className="min-w-0">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Teléfono</label>
              <div className="flex gap-2 min-w-0">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="px-2 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none bg-white flex-shrink-0"
                  style={{ '--tw-ring-color': TEAL, maxWidth: 110 } as any}
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10 dígitos"
                  className="flex-1 min-w-0 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
                  style={{ '--tw-ring-color': TEAL } as any}
                />
              </div>
              {phoneNumber.length > 0 && phoneNumber.length < 10 && (
                <p className="text-[11px] text-amber-700 mt-1">
                  El teléfono debe tener 10 dígitos.
                </p>
              )}
            </div>
          )}

          {/* Birth date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Fecha de nacimiento</label>
            <DatePicker
              value={form.birthDate}
              onChange={(v) => setForm((f) => ({ ...f, birthDate: v }))}
            />
          </div>

          {/* Gender */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Género</label>
            <select
              value={form.gender}
              onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none bg-white"
              style={{ '--tw-ring-color': TEAL } as any}
            >
              {GENDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Allergies */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Alergias <span className="text-gray-400">(opcional)</span>
            </label>
            <p className="text-xs text-gray-400 mb-1.5 leading-relaxed">
              Esta información nos ayuda a evitar ofrecerte servicios que puedan causarte una reacción alérgica. Los especialistas podrán verla cuando seas atendid@ para garantizar tu seguridad y la mejor experiencia posible.
            </p>
            <AllergiesSelector value={form.allergies} onChange={(v) => setForm((f) => ({ ...f, allergies: v }))} />
          </div>

          {/* Direccion (opcional) — para envios a domicilio de productos */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Dirección <span className="text-gray-400">(opcional)</span>
            </label>
            <p className="text-xs text-gray-400 mb-2 leading-relaxed">
              Para sugerirte negocios cercanos y facilitar envíos a domicilio.
            </p>
            <AddressFields value={address} onChange={setAddress} />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-3">{error}</p>
        )}

        <div className="mt-5 space-y-2">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full text-white py-2.5 rounded-xl font-medium text-sm disabled:opacity-50 transition-colors"
            style={{ backgroundColor: TEAL }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = TEAL_DARK)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL)}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button
            onClick={onSkip}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Después
          </button>
        </div>
      </div>
    </div>
  );
}

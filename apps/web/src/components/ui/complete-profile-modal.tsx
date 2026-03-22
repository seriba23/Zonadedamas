'use client';

import { useState } from 'react';
import { marketplaceApi } from '@/lib/marketplace-api';
import { DatePicker } from './date-picker';

const TEAL = '#008080';
const TEAL_DARK = '#006666';
const TEAL_LIGHT = '#e0f2f1';

interface CompleteProfileModalProps {
  user: {
    phone: string | null;
    birthDate?: string | null;
    gender?: string | null;
    allergies?: string | null;
  };
  onComplete: () => void;
  onSkip: () => void;
}

export function CompleteProfileModal({ user, onComplete, onSkip }: CompleteProfileModalProps) {
  const [form, setForm] = useState({
    phone: user.phone || '',
    birthDate: user.birthDate ? user.birthDate.split('T')[0] : '',
    gender: user.gender || '',
    allergies: user.allergies || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      await marketplaceApi.put('/auth/profile', {
        phone: form.phone || undefined,
        birthDate: form.birthDate || undefined,
        gender: form.gender || undefined,
        allergies: form.allergies || undefined,
      });
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="text-center mb-5">
          <div
            className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3"
            style={{ backgroundColor: TEAL_LIGHT }}
          >
            <svg className="w-7 h-7" style={{ color: TEAL }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">Completa tu perfil</h2>
          <p className="text-sm text-gray-500 mt-1">
            Estos datos nos ayudan a darte una mejor experiencia
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Phone */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Teléfono
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
              style={{ '--tw-ring-color': TEAL } as any}
              placeholder="+1-555-0000"
            />
          </div>

          {/* Birth date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Fecha de nacimiento
            </label>
            <DatePicker
              value={form.birthDate}
              onChange={(v) => setForm((f) => ({ ...f, birthDate: v }))}
            />
          </div>

          {/* Gender */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Género
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'FEMALE', label: 'Femenino' },
                { value: 'MALE', label: 'Masculino' },
                { value: 'NON_BINARY', label: 'No binario' },
                { value: 'PREFER_NOT_SAY', label: 'Prefiero no decir' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, gender: f.gender === opt.value ? '' : opt.value }))}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                  style={
                    form.gender === opt.value
                      ? { backgroundColor: TEAL, color: 'white' }
                      : { backgroundColor: '#f3f4f6', color: '#6b7280' }
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Allergies */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Alergias o notas médicas <span className="text-gray-400">(opcional)</span>
            </label>
            <textarea
              value={form.allergies}
              onChange={(e) => setForm((f) => ({ ...f, allergies: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none resize-none"
              style={{ '--tw-ring-color': TEAL } as any}
              rows={2}
              placeholder="Ej: alergia al latex, piel sensible..."
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-3">{error}</p>
        )}

        {/* Actions */}
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

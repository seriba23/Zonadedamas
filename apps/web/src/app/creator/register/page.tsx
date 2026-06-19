'use client';

import { useState } from 'react';
import Link from 'next/link';
import { creatorRegister } from '@/lib/creator-auth';
import { PasswordField, isPasswordValid } from '@/components/ui/password-field';

const TEAL = '#008080';

export default function CreatorRegisterPage() {
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await creatorRegister({
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
      });
      setDone(true);
    } catch (err: any) {
      setError(err?.message || 'No se pudo crear la cuenta');
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-6 text-center">
          <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: '#e0f2f1' }}>
            <svg className="w-7 h-7" fill="none" stroke={TEAL} viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">Cuenta creada</h2>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            Un administrador revisará y aprobará tu cuenta pronto. Te avisaremos cuando puedas entrar.
          </p>
          <Link href="/creator/login" className="inline-block px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: TEAL }}>
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black" style={{ color: TEAL }}>Siliba</h1>
          <p className="text-sm text-gray-500 mt-1">Únete como reclutador o creador de contenido</p>
        </div>
        <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
          <h2 className="text-lg font-bold text-gray-900">Crear cuenta</h2>
          <input type="email" placeholder="Email" value={form.email} required
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2" style={{ ['--tw-ring-color' as any]: TEAL }} />
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Nombre" value={form.firstName} required
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2" style={{ ['--tw-ring-color' as any]: TEAL }} />
            <input type="text" placeholder="Apellido" value={form.lastName} required
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2" style={{ ['--tw-ring-color' as any]: TEAL }} />
          </div>
          <input type="text" placeholder="Teléfono (opcional)" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2" style={{ ['--tw-ring-color' as any]: TEAL }} />
          <PasswordField
            value={form.password}
            onChange={(v) => setForm({ ...form, password: v })}
            placeholder="Contraseña"
            showRequirements
            required
          />
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={loading || !isPasswordValid(form.password)}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: TEAL }}>
            {loading ? 'Creando...' : 'Crear cuenta'}
          </button>
          <p className="text-xs text-center text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <Link href="/creator/login" className="font-medium" style={{ color: TEAL }}>Inicia sesión</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

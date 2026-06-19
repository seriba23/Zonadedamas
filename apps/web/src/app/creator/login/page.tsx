'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { creatorLogin } from '@/lib/creator-auth';
import { PasswordField } from '@/components/ui/password-field';

const TEAL = '#008080';

export default function CreatorLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await creatorLogin(email.trim(), password);
      router.replace('/creator/dashboard');
    } catch (err: any) {
      setError(err?.message || 'No se pudo iniciar sesión');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black" style={{ color: TEAL }}>Siliba</h1>
          <p className="text-sm text-gray-500 mt-1">Panel de reclutadores y creadores de contenido</p>
        </div>
        <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Iniciar sesión</h2>
          <input
            type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2"
            style={{ ['--tw-ring-color' as any]: TEAL }}
          />
          <PasswordField value={password} onChange={setPassword} placeholder="Contraseña" required />
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: TEAL }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          <p className="text-xs text-center text-gray-500">
            ¿No tienes cuenta?{' '}
            <Link href="/creator/register" className="font-medium" style={{ color: TEAL }}>Regístrate</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

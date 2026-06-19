'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { creatorSetPassword } from '@/lib/creator-auth';
import { PasswordField, isPasswordValid } from '@/components/ui/password-field';

const TEAL = '#008080';

function SetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await creatorSetPassword(token, password);
      if (res.accessToken) router.replace('/creator/dashboard');
      else router.replace('/creator/login');
    } catch (err: any) {
      setError(err?.message || 'No se pudo establecer la contraseña');
      setLoading(false);
    }
  }

  if (!token) {
    return <p className="text-sm text-red-600">Falta el token de invitación en el enlace.</p>;
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">Crea tu contraseña</h2>
      <p className="text-xs text-gray-500">Define la contraseña con la que entrarás a tu panel.</p>
      <PasswordField
        value={password}
        onChange={setPassword}
        placeholder="Contraseña"
        showRequirements
        autoFocus
        required
      />
      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <button type="submit" disabled={loading || !isPasswordValid(password)}
        className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: TEAL }}>
        {loading ? 'Guardando...' : 'Guardar y entrar'}
      </button>
    </form>
  );
}

export default function CreatorSetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black" style={{ color: TEAL }}>Siliba</h1>
          <p className="text-sm text-gray-500 mt-1">Panel de reclutadores y creadores de contenido</p>
        </div>
        <Suspense fallback={<p className="text-center text-gray-400 text-sm">Cargando...</p>}>
          <SetPasswordInner />
        </Suspense>
      </div>
    </div>
  );
}

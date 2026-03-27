'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useClientAuth } from '@/lib/hooks/use-client-auth';
import Link from 'next/link';

export default function PortalLoginPage() {
  const { login, isLoading: authLoading } = useClientAuth();
  const router = useRouter();
  const params = useParams();
  const slug = params.tenantSlug as string;

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(identifier, password);
      router.push(`/portal/${slug}/appointments`);
    } catch (err: any) {
      setError(err.message || 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-center mb-1" style={{ color: '#008080' }}>
            Siliba
          </h1>
          <p className="text-xs text-gray-400 text-center mb-1">Tu confianza, en manos de profesionales</p>
          <p className="text-sm text-gray-500 text-center mb-8">
            Inicia sesion para ver tus citas
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email o teléfono
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                placeholder="correo@ejemplo.com o +1234567890"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                placeholder="Tu contraseña"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            ¿No tienes cuenta?{' '}
            <Link
              href={`/portal/${slug}/register`}
              className="text-indigo-600 font-medium hover:text-indigo-700"
            >
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

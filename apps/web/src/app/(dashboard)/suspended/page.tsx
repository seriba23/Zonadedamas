'use client';

import { useAuth } from '@/lib/hooks/use-auth';

export default function SuspendedPage() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Cuenta suspendida</h1>
          <p className="text-gray-600 mb-6">
            Tu suscripción ha sido suspendida por falta de pago. Para reactivar tu cuenta,
            contacta con soporte o realiza el pago pendiente.
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Contacto de soporte</h3>
            <p className="text-sm text-gray-600">soporte@siliba.com</p>
          </div>

          <button
            onClick={() => logout()}
            className="w-full btn-primary py-2.5"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}

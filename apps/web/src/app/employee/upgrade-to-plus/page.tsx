'use client';

import { useRouter } from 'next/navigation';
import { useTenantTier } from '@/lib/hooks/use-tenant-tier';

const TEAL = '#008080';
const TEAL_LIGHT = '#e0f2f1';

interface FeatureRow {
  label: string;
  pro: boolean;
  plus: boolean;
  highlight?: boolean;
}

const FEATURES: FeatureRow[] = [
  { label: 'Citas ilimitadas', pro: true, plus: true },
  { label: 'Clientes ilimitados', pro: true, plus: true },
  { label: 'Servicios y agenda', pro: true, plus: true },
  { label: 'Cupones y recompensas', pro: true, plus: true },
  { label: 'Inventario y proveedores', pro: true, plus: true },
  { label: 'Pagos y facturacion', pro: true, plus: true },
  { label: 'Personal y empleados', pro: false, plus: true },
  { label: 'Roles y permisos personalizados', pro: false, plus: true },
  { label: 'Codigos de invitacion para tu equipo', pro: false, plus: true },
  { label: 'Horarios por empleado', pro: false, plus: true },
  { label: 'Control de asistencias', pro: false, plus: true },
  { label: 'Tienda — vende productos a tus clientes', pro: false, plus: true },
];

export default function EmployeeUpgradeToPlusPage() {
  const router = useRouter();
  const { isFreelancer } = useTenantTier();

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-8">
            <div
              className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: TEAL_LIGHT }}
            >
              <svg
                className="w-10 h-10"
                style={{ color: TEAL }}
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 2h14v2H5v-2z" />
              </svg>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              Pasa a Siliba PLUS
            </h1>
            <p className="text-gray-500 max-w-xl mx-auto">
              Lleva tu negocio al siguiente nivel: arma tu equipo, asigna roles
              y vende productos directamente a tus clientes.
            </p>
          </div>

          {/* Tabla comparativa */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="grid grid-cols-[1fr_100px_100px] md:grid-cols-[1fr_140px_140px] bg-gray-50 border-b border-gray-200">
              <div className="px-4 md:px-6 py-3 text-xs md:text-sm font-semibold text-gray-600">
                Funcion
              </div>
              <div className="px-2 md:px-4 py-3 text-center">
                <div className="text-xs md:text-sm font-semibold text-gray-700">
                  PRO
                </div>
                <div className="text-[10px] md:text-xs text-gray-500">
                  $300 MXN/mes
                </div>
              </div>
              <div
                className="px-2 md:px-4 py-3 text-center"
                style={{ backgroundColor: TEAL_LIGHT }}
              >
                <div
                  className="text-xs md:text-sm font-semibold flex items-center justify-center gap-1"
                  style={{ color: TEAL }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 md:w-4 md:h-4">
                    <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 2h14v2H5v-2z" />
                  </svg>
                  PLUS
                </div>
                <div className="text-[10px] md:text-xs text-gray-500">
                  $500 MXN/mes
                </div>
              </div>
            </div>

            {FEATURES.map((f, i) => (
              <div
                key={f.label}
                className={`grid grid-cols-[1fr_100px_100px] md:grid-cols-[1fr_140px_140px] items-center ${
                  i !== FEATURES.length - 1 ? 'border-b border-gray-100' : ''
                } ${f.highlight ? 'bg-teal-50/40' : ''}`}
              >
                <div className="px-4 md:px-6 py-3 text-sm text-gray-800 flex items-center gap-2">
                  <span>{f.label}</span>
                </div>
                <div className="px-2 md:px-4 py-3 text-center">
                  {f.pro ? (
                    <CheckIcon color={TEAL} />
                  ) : (
                    <CrossIcon color="#9ca3af" />
                  )}
                </div>
                <div className="px-2 md:px-4 py-3 text-center">
                  {f.plus ? (
                    <CheckIcon color={TEAL} />
                  ) : (
                    <CrossIcon color="#9ca3af" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          {isFreelancer ? (
            <div className="mt-8 flex flex-col items-center gap-3">
              <button
                onClick={() => router.push('/employee/subscription')}
                className="w-full md:w-auto md:min-w-[280px] py-3 px-6 text-white rounded-xl text-base font-semibold transition-colors"
                style={{ backgroundColor: TEAL }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = '#006666')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = TEAL)
                }
              >
                Mejorar a PLUS
              </button>
              <button
                onClick={() => router.back()}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Mas tarde
              </button>
            </div>
          ) : (
            <div className="mt-8 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-sm font-medium">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 2h14v2H5v-2z" />
                </svg>
                Ya cuentas con el plan PLUS
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg
      className="w-5 h-5 mx-auto"
      style={{ color }}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 12.75l6 6 9-13.5"
      />
    </svg>
  );
}

function CrossIcon({ color }: { color: string }) {
  return (
    <svg
      className="w-4 h-4 mx-auto"
      style={{ color }}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

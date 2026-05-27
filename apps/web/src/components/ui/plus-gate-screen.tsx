'use client';

import { useRouter } from 'next/navigation';

const TEAL = '#008080';
const TEAL_LIGHT = '#e0f2f1';

interface PlusGateScreenProps {
  feature: string;
  description?: string;
}

export function PlusGateScreen({ feature, description }: PlusGateScreenProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
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
      <h2 className="text-xl font-bold text-gray-900 mb-2">
        {feature} es una funcion de PLUS
      </h2>
      <p className="text-sm text-gray-500 max-w-md mb-6">
        {description ||
          'Esta seccion forma parte del plan PLUS ($500 MXN/mes), pensado para negocios con equipo de trabajo. Mejora tu plan para desbloquearla.'}
      </p>
      <button
        onClick={() => router.push('/upgrade-to-plus')}
        className="py-2.5 px-6 text-white rounded-xl text-sm font-semibold transition-colors"
        style={{ backgroundColor: TEAL }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = '#006666')
        }
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL)}
      >
        Ver beneficios de PLUS
      </button>
    </div>
  );
}

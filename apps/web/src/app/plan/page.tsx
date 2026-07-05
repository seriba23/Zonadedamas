// ─────────────────────────────────────────────────────────────────────────────
// RUTA: /plan
//
// Vista de "Administrador" para el PROFESIONAL INDEPENDIENTE (freelancer). Un
// freelancer no tiene panel de administración (no tiene equipo): su único
// "admin" es gestionar su suscripción. Por eso, al elegir "Administrador" en el
// selector de perfil del login, llega aquí: SOLO la suscripción, SIN menú lateral,
// con un botón para volver al selector y entrar como Profesional.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useRouter } from 'next/navigation';
import SubscriptionContent from '@/app/(dashboard)/settings/subscription/page';

export default function FreelancerPlanPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f8f7' }}>
      {/* Barra minima: logo + volver al selector (NO hay menú lateral). */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ backgroundColor: 'var(--soft-card)', borderColor: 'var(--soft-border)' }}
      >
        <span className="text-[20px] font-extrabold tracking-[-0.02em] text-[#008080]">Siliba</span>
        <button
          onClick={() => router.push('/login')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#5b6e6a] hover:text-[#008080] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Volver al selector de perfil
        </button>
      </div>

      {/* Reutiliza la misma pantalla de suscripción (Stripe, upsell a PLUS, etc.). */}
      <SubscriptionContent />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// /creator/access — PUERTA DE ACCESO al portal de creadores.
//
// Reemplaza el antiguo login propio (/creator/login). Como el usuario YA está
// autenticado en Siliba (empleado / freelancer / administrador), aquí NO se pide
// usuario ni contraseña: intentamos el SSO con la sesión activa y, según el
// resultado, entramos al panel o mostramos el estado correspondiente:
//   - APROBADO         → dashboard.
//   - PENDIENTE (403)  → "en revisión".
//   - SUSPENDIDO (403) → aviso.
//   - NO ES CREADOR (404) → botón "Solicitar unirme" (crea la solicitud SIN login).
//   - SIN SESIÓN SILIBA (401) → invitar a iniciar sesión en la app.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { creatorLoginFromSession, creatorApplyFromSession, markCreatorIntroSeen } from '@/lib/creator-auth';

type State =
  | { kind: 'loading' }
  | { kind: 'apply' }        // no es creador aún → puede solicitar
  | { kind: 'pending'; message: string }
  | { kind: 'blocked'; message: string } // suspendido u otro 403
  | { kind: 'need-login' }   // sin sesión de Siliba
  | { kind: 'ended' }        // cerró sesión del portal
  | { kind: 'error'; message: string };

// useSearchParams() requiere estar envuelto en <Suspense> en el App Router de
// Next.js (sin él, el build de producción falla al prerenderizar la página).
// Por eso el contenido real vive en este componente hijo y el default export
// solo lo envuelve en <Suspense>.
function CreatorAccessInner() {
  const router = useRouter();
  const params = useSearchParams();
  const ended = params.get('end') === '1';

  const [state, setState] = useState<State>(ended ? { kind: 'ended' } : { kind: 'loading' });
  const [applying, setApplying] = useState(false);

  // Intenta el SSO y decide a dónde ir según el resultado.
  const attemptSso = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      await creatorLoginFromSession();
      markCreatorIntroSeen();
      router.replace('/creator/dashboard');
    } catch (e: any) {
      const status = e?.statusCode ?? e?.status;
      const message = e?.message || 'No pudimos acceder al portal de creadores.';
      // El cliente `api` lanza un Error plano "Sesión expirada" cuando no hay
      // sesión de Siliba válida (401 + refresh fallido): lo tratamos como need-login.
      const noSession = status === 401 || /sesi[óo]n expirada|sesi[óo]n inv[áa]lida/i.test(message);
      if (status === 404) setState({ kind: 'apply' });
      else if (status === 403 && /revisi[óo]n|pendiente|aprob/i.test(message)) setState({ kind: 'pending', message });
      else if (status === 403) setState({ kind: 'blocked', message });
      else if (noSession) setState({ kind: 'need-login' });
      else setState({ kind: 'error', message });
    }
  }, [router]);

  useEffect(() => {
    if (!ended) attemptSso();
  }, [ended, attemptSso]);

  async function handleApply() {
    setApplying(true);
    try {
      await creatorApplyFromSession();
      setState({ kind: 'pending', message: 'Recibimos tu solicitud. Un administrador la revisará y te avisaremos al aprobarla.' });
    } catch (e: any) {
      setState({ kind: 'error', message: e?.message || 'No pudimos registrar tu solicitud.' });
    } finally {
      setApplying(false);
    }
  }

  // ── UI ──────────────────────────────────────────────────────────────────
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-[100dvh] bg-black text-white flex flex-col items-center justify-center px-8 text-center">
      <div className="max-w-sm w-full">{children}</div>
    </div>
  );

  const PrimaryBtn = ({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl bg-white py-3.5 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {children}
    </button>
  );

  const GhostBtn = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick} className="w-full mt-2 py-3 text-sm text-white/50 hover:text-white/80 transition-colors">
      {children}
    </button>
  );

  if (state.kind === 'loading') {
    return (
      <Shell>
        <div className="mx-auto h-10 w-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        <p className="mt-5 text-sm text-white/60">Accediendo al portal de creadores…</p>
      </Shell>
    );
  }

  if (state.kind === 'apply') {
    return (
      <Shell>
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gray-900 ring-1 ring-white/10 mx-auto">
          <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">Únete como creador</h1>
        <p className="mt-3 mb-6 text-sm leading-relaxed text-white/60">
          Recomienda negocios y profesionales con tu código y gana comisiones cada mes. Con tu cuenta de Siliba puedes solicitar unirte ahora mismo.
        </p>
        <PrimaryBtn onClick={handleApply} disabled={applying}>
          {applying ? 'Enviando solicitud…' : 'Solicitar unirme'}
        </PrimaryBtn>
        <GhostBtn onClick={() => router.push('/')}>Volver a la app</GhostBtn>
      </Shell>
    );
  }

  if (state.kind === 'pending') {
    return (
      <Shell>
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gray-900 ring-1 ring-white/10 mx-auto">
          <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">Solicitud en revisión</h1>
        <p className="mt-3 mb-6 text-sm leading-relaxed text-white/60">{state.message}</p>
        <PrimaryBtn onClick={() => router.push('/')}>Volver a la app</PrimaryBtn>
      </Shell>
    );
  }

  if (state.kind === 'blocked') {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">Acceso no disponible</h1>
        <p className="mt-3 mb-6 text-sm leading-relaxed text-white/60">{state.message}</p>
        <PrimaryBtn onClick={() => router.push('/')}>Volver a la app</PrimaryBtn>
      </Shell>
    );
  }

  if (state.kind === 'need-login') {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">Inicia sesión en Siliba</h1>
        <p className="mt-3 mb-6 text-sm leading-relaxed text-white/60">
          El portal de creadores usa tu cuenta de Siliba. Inicia sesión y vuelve a entrar a Reclutadores.
        </p>
        <PrimaryBtn onClick={() => router.push('/login')}>Ir a iniciar sesión</PrimaryBtn>
      </Shell>
    );
  }

  if (state.kind === 'ended') {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">Sesión cerrada</h1>
        <p className="mt-3 mb-6 text-sm leading-relaxed text-white/60">Saliste del portal de creadores.</p>
        <PrimaryBtn onClick={attemptSso}>Entrar de nuevo</PrimaryBtn>
        <GhostBtn onClick={() => router.push('/')}>Volver a la app</GhostBtn>
      </Shell>
    );
  }

  // error
  return (
    <Shell>
      <h1 className="text-2xl font-bold">Algo salió mal</h1>
      <p className="mt-3 mb-6 text-sm leading-relaxed text-white/60">{state.message}</p>
      <PrimaryBtn onClick={attemptSso}>Reintentar</PrimaryBtn>
      <GhostBtn onClick={() => router.push('/')}>Volver a la app</GhostBtn>
    </Shell>
  );
}

export default function CreatorAccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-black text-white flex flex-col items-center justify-center px-8 text-center">
          <div className="mx-auto h-10 w-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          <p className="mt-5 text-sm text-white/60">Accediendo al portal de creadores…</p>
        </div>
      }
    >
      <CreatorAccessInner />
    </Suspense>
  );
}

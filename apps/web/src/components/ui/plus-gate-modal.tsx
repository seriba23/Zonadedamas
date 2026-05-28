'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

const TEAL = '#008080';
const TEAL_LIGHT = '#e0f2f1';

interface PlusGateModalProps {
  show: boolean;
  feature: string | null;
  onClose: () => void;
}

export function PlusGateModal({ show, feature, onClose }: PlusGateModalProps) {
  const router = useRouter();
  // Portal a document.body para escapar de containers con z-index/overflow
  // (ej. el <aside> del sidebar). Garantiza que cubra toda la pantalla.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Cerrar con ESC
  useEffect(() => {
    if (!show) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show, onClose]);

  if (!mounted || !show || !feature) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative bg-white rounded-2xl p-6 max-w-sm w-full text-center animate-in zoom-in-95 duration-200 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Boton cerrar (X) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div
          className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4"
          style={{ backgroundColor: TEAL_LIGHT }}
        >
          <svg
            className="w-8 h-8"
            style={{ color: TEAL }}
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 2h14v2H5v-2z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">
          Funcion exclusiva de PLUS
        </h3>
        <p className="text-sm text-gray-500 mb-5">
          La funcion <strong>{feature}</strong> necesita el plan PLUS de $500
          MXN/mes. Gestiona tu equipo, asigna roles y vende productos a tus
          clientes.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              onClose();
              router.push('/upgrade-to-plus');
            }}
            className="w-full py-2.5 text-white rounded-xl text-sm font-medium transition-colors"
            style={{ backgroundColor: TEAL }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = '#006666')
            }
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL)}
          >
            Ver beneficios
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Mas tarde
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

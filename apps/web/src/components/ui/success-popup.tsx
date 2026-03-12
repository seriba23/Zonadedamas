'use client';

import { useEffect } from 'react';

const TEAL = '#008080';
const TEAL_LIGHT = '#e0f2f1';

interface SuccessPopupProps {
  show: boolean;
  title: string;
  message?: string;
  onClose: () => void;
  /** Auto-close after ms (0 = no auto-close). Default: 0 */
  autoClose?: number;
}

export function SuccessPopup({ show, title, message, onClose, autoClose = 0 }: SuccessPopupProps) {
  useEffect(() => {
    if (show && autoClose > 0) {
      const timer = setTimeout(onClose, autoClose);
      return () => clearTimeout(timer);
    }
  }, [show, autoClose, onClose]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full text-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4"
          style={{ backgroundColor: TEAL_LIGHT }}
        >
          <svg
            className="w-8 h-8"
            style={{ color: TEAL }}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
        {message && <p className="text-sm text-gray-500 mb-4">{message}</p>}
        <button
          onClick={onClose}
          className="w-full py-2.5 text-white rounded-xl text-sm font-medium transition-colors mt-2"
          style={{ backgroundColor: TEAL }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#006666')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL)}
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';

const TEAL = '#008080';

interface StarRatingProps {
  value: number;
  onChange: (v: number) => void;
}

function StarRating({ value, onChange }: StarRatingProps) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform active:scale-110"
        >
          <svg
            className="w-8 h-8"
            fill={(hovered || value) >= star ? '#f59e0b' : 'none'}
            stroke={(hovered || value) >= star ? '#f59e0b' : '#d1d5db'}
            viewBox="0 0 24 24"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.563.563 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

interface DualReviewModalProps {
  show: boolean;
  /** Nombre del profesional que dio el servicio. */
  employeeName: string;
  /** Nombre del negocio (ignorado si mode='freelancer' — ahí no hay negocio). */
  businessName: string;
  /**
   * Modo de reseña:
   * - 'business' (default): rating del servicio (required) + rating del negocio (opcional)
   * - 'freelancer': rating del servicio (required) + rating del profesional (opcional)
   * En ambos casos el primer rating se guarda en `rating` y el segundo en `businessRating`.
   */
  mode?: 'business' | 'freelancer';
  onSubmit: (data: {
    rating: number;
    comment?: string;
    businessRating?: number;
    businessComment?: string;
  }) => void;
  onSkip: () => void;
  isLoading?: boolean;
}

export function DualReviewModal({
  show,
  employeeName,
  businessName,
  mode = 'business',
  onSubmit,
  onSkip,
  isLoading,
}: DualReviewModalProps) {
  const [employeeRating, setEmployeeRating] = useState(0);
  const [employeeComment, setEmployeeComment] = useState('');
  const [businessRating, setBusinessRating] = useState(0);
  const [businessComment, setBusinessComment] = useState('');

  if (!show) return null;

  const handleSubmit = () => {
    if (employeeRating === 0) return;
    onSubmit({
      rating: employeeRating,
      comment: employeeComment || undefined,
      businessRating: businessRating || undefined,
      businessComment: businessComment || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: '#e0f2f1' }}>
            <svg className="w-6 h-6" style={{ color: TEAL }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.563.563 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">¿Cómo fue tu experiencia?</h2>
          <p className="text-sm text-gray-500 mt-0.5">Tu opinión ayuda a mejorar el servicio</p>
        </div>

        <div className="px-6 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Rating principal: AL PROFESIONAL que dio el servicio (modo
              business y freelancer). Se guarda en EmployeeReview.rating y
              afecta el promedio del empleado. */}
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-1">
              Califica al{' '}
              <span style={{ color: TEAL }}>
                profesional{employeeName ? ` (${employeeName})` : ''}
              </span>
            </p>
            <StarRating value={employeeRating} onChange={setEmployeeRating} />
            {employeeRating > 0 && (
              <textarea
                value={employeeComment}
                onChange={(e) => setEmployeeComment(e.target.value)}
                placeholder="¿Cómo te atendió el profesional? (opcional)"
                rows={2}
                className="mt-2 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2"
                style={{ ['--tw-ring-color' as any]: TEAL }}
              />
            )}
          </div>

          {/* Rating secundario opcional:
              - 'business' → al negocio (afecta TenantReview / promedio del tenant)
              - 'freelancer' → no aplica (no hay negocio que calificar) */}
          {mode === 'business' && (
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                Califica <span style={{ color: TEAL }}>{businessName}</span>{' '}
                <span className="text-xs text-gray-400 font-normal">(opcional)</span>
              </p>
              <StarRating value={businessRating} onChange={setBusinessRating} />
              {businessRating > 0 && (
                <textarea
                  value={businessComment}
                  onChange={(e) => setBusinessComment(e.target.value)}
                  placeholder="¿Cómo te pareció el lugar? (opcional)"
                  rows={2}
                  className="mt-2 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2"
                  style={{ ['--tw-ring-color' as any]: TEAL }}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 flex gap-2">
          <button
            onClick={onSkip}
            className="flex-shrink-0 py-2.5 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Omitir
          </button>
          <button
            onClick={handleSubmit}
            disabled={employeeRating === 0 || isLoading}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-40"
            style={{ backgroundColor: TEAL }}
          >
            {isLoading ? 'Enviando...' : 'Enviar calificación'}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import type { MouseEvent } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const CATEGORY_LABELS: Record<string, string> = {
  SALON: 'Salón',
  BARBERIA: 'Barbería',
  SPA: 'SPA',
  CLINICA: 'Clínica',
  TATUAJES: 'Tatuajes',
};

export interface BusinessCardData {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  cardColor: string | null;
  businessType: string | null;
  distance?: number | null;
  averageRating?: number | null;
  totalReviews?: number;
  completedAppointments?: number;
  hasImmediateAvailability?: boolean;
}

interface MarketplaceBusinessCardProps {
  biz: BusinessCardData;
  onClick?: () => void;
  showFavorite?: boolean;
  isFav?: boolean;
  isAnimating?: boolean;
  onToggleFavorite?: (e: MouseEvent) => void;
}

export function MarketplaceBusinessCard({
  biz,
  onClick,
  showFavorite = false,
  isFav = false,
  isAnimating = false,
  onToggleFavorite,
}: MarketplaceBusinessCardProps) {
  const hasCover = !!biz.coverImageUrl;
  const bgColor = biz.cardColor || '#008080';
  const completed = biz.completedAppointments ?? 0;

  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl overflow-hidden text-left active:scale-[0.98] transition-transform relative"
      style={{ height: 140 }}
    >
      {/* Background: cover image or solid color */}
      {hasCover ? (
        <img
          src={`${API_URL}${biz.coverImageUrl}`}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0" style={{ backgroundColor: bgColor }} />
      )}

      {/* Gradient: top 50% limpio, de ahí baja suave hasta denso en el borde */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 30%, rgba(0,0,0,0.15) 50%, transparent 55%)' }}
      />

      {/* Content */}
      <div className="relative h-full flex flex-col justify-between p-3">

        {/* Top row: logo circle (left) + heart (right) */}
        <div className="flex items-start justify-between">
          {/* Logo circle */}
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-white shadow-md"
            style={{
              backgroundColor: bgColor,
              zIndex: 10,
              position: 'relative',
            }}
          >
            {biz.logoUrl ? (
              <img
                src={`${API_URL}${biz.logoUrl}`}
                alt={biz.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xl font-black text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                {biz.name[0]}
              </span>
            )}
          </div>

          {/* Heart */}
          {showFavorite && (
            <button
              onClick={onToggleFavorite}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-sm flex-shrink-0"
              style={{ zIndex: 10, position: 'relative' }}
            >
              <svg
                className={`w-4 h-4${isAnimating ? ' heart-pop' : ''}`}
                fill={isFav ? '#008080' : 'none'}
                stroke={isFav ? '#008080' : '#6b7280'}
                viewBox="0 0 24 24"
                strokeWidth={2}
                style={{ transition: 'fill 0.2s ease, stroke 0.2s ease' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </button>
          )}
        </div>

        {/* Bottom: name, category, stats + distance */}
        <div>
          <p className="text-base font-black text-white leading-tight truncate" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
            {biz.name}
          </p>
          {biz.businessType && (
            <p className="text-xs font-semibold text-white/90 mt-0.5">
              {CATEGORY_LABELS[biz.businessType.split(',')[0]] || biz.businessType.split(',')[0]}
            </p>
          )}
          <div className="flex items-center justify-between mt-1.5">
            {/* Izquierda: distancia + disponible */}
            <div className="flex items-center gap-2">
              {biz.distance != null && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-white bg-black/40 px-1.5 py-0.5 rounded-full">
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                  </svg>
                  {biz.distance < 1 ? `${Math.round(biz.distance * 1000)} m` : `${biz.distance} km`}
                </span>
              )}
              {biz.hasImmediateAvailability && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-white bg-green-500/80 px-1.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  Disponible
                </span>
              )}
            </div>
            {/* Derecha: estrellas (solo si tiene 10+ servicios realizados) */}
            {completed >= 10 && biz.averageRating != null && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-sm font-semibold text-white">{biz.averageRating}</span>
                <span className="text-xs text-white/70">({biz.totalReviews ?? 0})</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* "NUEVO" — triángulo relleno esquina inferior derecha.
          z-10 para que NUNCA se monte sobre el header sticky (z-30). */}
      {completed < 10 && (
        <div
          className="absolute bottom-0 right-0 z-10"
          style={{
            width: 70,
            height: 70,
            clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
            backgroundColor: 'rgba(34,197,94,0.85)',
          }}
        >
          <span
            className="absolute font-black text-white"
            style={{
              fontSize: 11,
              letterSpacing: '0.06em',
              top: '64%',
              left: '64%',
              transform: 'translate(-50%, -50%) rotate(-45deg)',
            }}
          >
            NUEVO
          </span>
        </div>
      )}
    </button>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';
import { marketplaceApi } from '@/lib/marketplace-api';
import { formatCurrency } from '@/lib/utils';
import MarketplaceHeader from '../marketplace-header';

dayjs.locale('es');

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TEAL = '#008080';
const TEAL_DARK = '#006666';
const TEAL_LIGHT = '#e0f2f1';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-50 text-yellow-700' },
  CONFIRMED: { label: 'Confirmada', color: 'bg-blue-50 text-blue-700' },
  RESCHEDULED: { label: 'Reagendada', color: 'bg-orange-50 text-orange-700' },
  IN_PROGRESS: { label: 'En curso', color: 'bg-purple-50 text-purple-700' },
  COMPLETED: { label: 'Completada', color: 'bg-green-50 text-green-700' },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-50 text-red-700' },
  NO_SHOW: { label: 'No asistio', color: 'bg-gray-100 text-gray-600' },
};

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
  };
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    color: string;
    avatarUrl: string | null;
  };
  items: {
    id: string;
    serviceNameSnapshot: string;
    priceSnapshot: string | number;
    durationSnapshot: number;
  }[];
}

interface GalleryCategory {
  name: string;
  photos: {
    id: string;
    imageUrl: string;
    serviceName: string;
    date: string;
    tenantName: string;
    tenantSlug: string;
  }[];
}

interface FavoriteBusiness {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  businessType: string | null;
  address: string | null;
  averageRating: number | null;
  totalReviews: number;
}

interface Stats {
  totalServices: number;
  totalPoints: number;
  totalPhotos: number;
}

// ─── Appointment Card ──────────────────────────────────

function AppointmentCard({ apt }: { apt: Appointment }) {
  const status = STATUS_CONFIG[apt.status] || {
    label: apt.status,
    color: 'bg-gray-100 text-gray-600',
  };
  const totalPrice = apt.items.reduce(
    (sum, item) => sum + Number(item.priceSnapshot || 0),
    0,
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
        <Link
          href={`/marketplace/${apt.tenant.slug}`}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
            {apt.tenant.logoUrl ? (
              <img
                src={`${API_URL}${apt.tenant.logoUrl}`}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs font-bold text-gray-400">
                {apt.tenant.name[0]}
              </span>
            )}
          </div>
          <span className="text-xs font-medium text-gray-600">
            {apt.tenant.name}
          </span>
        </Link>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}
        >
          {status.label}
        </span>
      </div>

      <div className="mb-2">
        <p className="text-sm font-semibold text-gray-900">
          {dayjs(apt.startTime).format('ddd, D [de] MMM YYYY')}
        </p>
        <p className="text-xs text-gray-500">
          {dayjs(apt.startTime).format('h:mm A')} -{' '}
          {dayjs(apt.endTime).format('h:mm A')}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden"
          style={{ backgroundColor: apt.employee.color || TEAL }}
        >
          {apt.employee.avatarUrl ? (
            <img src={`${API_URL}${apt.employee.avatarUrl}`} alt="" className="w-full h-full object-cover" />
          ) : (
            <>{apt.employee.firstName[0]}{apt.employee.lastName[0]}</>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-700">
            {apt.employee.firstName} {apt.employee.lastName}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {apt.items.map((i) => i.serviceNameSnapshot).join(', ')}
          </p>
        </div>
        <span className="text-sm font-semibold text-gray-900 flex-shrink-0">
          {formatCurrency(totalPrice)}
        </span>
      </div>
    </div>
  );
}

// ─── Gallery Lightbox ──────────────────────────────────

function GalleryLightbox({
  photo,
  onClose,
}: {
  photo: GalleryCategory['photos'][0];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <img
            src={`${API_URL}${photo.imageUrl}`}
            alt={photo.serviceName}
            className="w-full max-h-[60vh] object-contain bg-gray-50"
          />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">
          <p className="text-sm font-semibold text-gray-900">{photo.serviceName}</p>
          <p className="text-xs text-gray-500 mt-1">
            {photo.tenantName} &middot; {dayjs(photo.date).format('D [de] MMM YYYY')}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Contact Change Form ───────────────────────────────

// ─── Main Profile Page ─────────────────────────────────

export default function MarketplaceProfilePage() {
  const { user, isAuthenticated, isLoading: authLoading, logout, refreshUser } =
    useMarketplaceAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showGallery, setShowGallery] = useState(false);
  const [showPastAppointments, setShowPastAppointments] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<GalleryCategory['photos'][0] | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/marketplace/login?redirect=/marketplace/profile');
    }
  }, [authLoading, isAuthenticated, router]);

  // Stats
  const { data: statsData } = useQuery({
    queryKey: ['marketplace-my-stats'],
    queryFn: () => marketplaceApi.get<{ data: Stats }>('/my-stats'),
    enabled: isAuthenticated,
  });
  const stats: Stats = (statsData as any)?.data || { totalServices: 0, totalPoints: 0, totalPhotos: 0 };

  // Upcoming appointments
  const { data: upcomingData, isLoading: upcomingLoading } = useQuery({
    queryKey: ['marketplace-my-appointments', 'upcoming'],
    queryFn: () =>
      marketplaceApi.get<{ data: Appointment[]; meta: any }>(
        '/my-appointments?filter=upcoming&perPage=5',
      ),
    enabled: isAuthenticated,
  });
  const upcomingAppointments: Appointment[] = (upcomingData as any)?.data || [];

  // Past appointments
  const { data: pastData, isLoading: pastLoading } = useQuery({
    queryKey: ['marketplace-my-appointments', 'past'],
    queryFn: () =>
      marketplaceApi.get<{ data: Appointment[]; meta: any }>(
        '/my-appointments?filter=past&perPage=5',
      ),
    enabled: isAuthenticated,
  });
  const pastAppointments: Appointment[] = (pastData as any)?.data || [];

  // Gallery
  const { data: galleryData } = useQuery({
    queryKey: ['marketplace-my-gallery'],
    queryFn: () => marketplaceApi.get<{ data: GalleryCategory[] }>('/my-gallery'),
    enabled: isAuthenticated,
  });
  const galleryCategories: GalleryCategory[] = (galleryData as any)?.data || [];

  // My rewards / coupons
  const { data: rewardsData } = useQuery({
    queryKey: ['marketplace-my-rewards'],
    queryFn: () => marketplaceApi.get<{ data: any[] }>('/my-rewards'),
    enabled: isAuthenticated,
  });
  const myRewards: any[] = (rewardsData as any)?.data || [];

  // Favorites
  const { data: favoritesData, isLoading: favoritesLoading } = useQuery({
    queryKey: ['marketplace-my-favorites'],
    queryFn: () => marketplaceApi.get<{ data: FavoriteBusiness[] }>('/my-favorites'),
    enabled: isAuthenticated,
  });
  const favorites: FavoriteBusiness[] = (favoritesData as any)?.data || [];

  const removeFavMutation = useMutation({
    mutationFn: (slug: string) =>
      marketplaceApi.post(`/favorites/${slug}`),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-my-favorites'] });
    },
  });

  const filteredPhotos = selectedCategory
    ? galleryCategories.find((c) => c.name === selectedCategory)?.photos || []
    : galleryCategories.flatMap((c) => c.photos);

  const handleLogout = () => {
    logout();
    router.push('/marketplace');
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: TEAL }} />
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  const initials = `${(user.firstName || '')[0] || ''}${(user.lastName || '')[0] || ''}`.toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      <MarketplaceHeader />

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* ─── Hero Card ─────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center relative">
          {/* Settings gear */}
          <Link
            href="/marketplace/settings"
            className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Configuración"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </Link>
          {/* Avatar */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-3 overflow-hidden"
            style={{ backgroundColor: TEAL_LIGHT }}
          >
            {user.avatarUrl ? (
              <img
                src={`${API_URL}${user.avatarUrl}`}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl font-bold" style={{ color: TEAL }}>
                {initials}
              </span>
            )}
          </div>

          <h1 className="text-lg font-bold text-gray-900">
            {user.firstName} {user.lastName}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
          {(user as any).socialProvider && (
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                {(user as any).socialProvider === 'google' ? (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="#1877F2" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                )}
                Conectado con {(user as any).socialProvider === 'google' ? 'Google' : 'Facebook'}
              </span>
            </div>
          )}
        </div>

        {/* ─── Stats + Gallery Button ────────────────── */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: TEAL }}>
              {stats.totalPoints.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">Puntos</p>
          </div>
          <button
            onClick={() => setShowPastAppointments(!showPastAppointments)}
            className="rounded-xl border p-4 text-center transition-all"
            style={showPastAppointments ? {
              backgroundColor: TEAL_LIGHT,
              borderColor: TEAL,
              boxShadow: `0 0 0 2px ${TEAL_LIGHT}`,
            } : {
              backgroundColor: 'white',
              borderColor: '#e5e7eb',
            }}
          >
            <p className="text-2xl font-bold" style={{ color: TEAL }}>
              {stats.totalServices}
            </p>
            <p className="text-xs text-gray-500 mt-1">Servicios</p>
          </button>
          <button
            onClick={() => setShowFavorites(!showFavorites)}
            className="rounded-xl border p-4 text-center transition-all"
            style={showFavorites ? {
              backgroundColor: TEAL_LIGHT,
              borderColor: TEAL,
              boxShadow: `0 0 0 2px ${TEAL_LIGHT}`,
            } : {
              backgroundColor: 'white',
              borderColor: '#e5e7eb',
            }}
          >
            <p className="text-2xl font-bold" style={{ color: TEAL }}>
              {favorites.length}
            </p>
            <p className="text-xs text-gray-500 mt-1">Favoritos</p>
          </button>
          <button
            onClick={() => { setShowGallery(!showGallery); setSelectedCategory(null); }}
            className="rounded-xl p-4 text-center transition-colors text-white"
            style={{ backgroundColor: showGallery ? TEAL_DARK : TEAL }}
          >
            <svg className="w-6 h-6 mx-auto mb-1" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A1.5 1.5 0 0 0 21.75 19.5V4.5A1.5 1.5 0 0 0 20.25 3H3.75A1.5 1.5 0 0 0 2.25 4.5v15A1.5 1.5 0 0 0 3.75 21Z" />
            </svg>
            <p className="text-xs font-medium">Galeria</p>
          </button>
        </div>

        {/* ─── Past Appointments (toggles from Servicios) ── */}
        {showPastAppointments && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Citas pasadas</h3>
            {pastLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 mx-auto" style={{ borderColor: TEAL }} />
              </div>
            ) : pastAppointments.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No tienes citas pasadas</p>
            ) : (
              <div className="space-y-3">
                {pastAppointments.map((apt) => (
                  <AppointmentCard key={apt.id} apt={apt} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Favorites (toggles from Favoritos) ────── */}
        {showFavorites && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Mis favoritos</h3>
            {favoritesLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 mx-auto" style={{ borderColor: TEAL }} />
              </div>
            ) : favorites.length === 0 ? (
              <div className="text-center py-6">
                <svg className="w-8 h-8 mx-auto text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
                <p className="text-gray-400 text-sm">Aun no tienes favoritos</p>
                <Link
                  href="/marketplace"
                  className="text-sm font-medium mt-2 inline-block"
                  style={{ color: TEAL }}
                >
                  Explorar negocios
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {favorites.map((biz) => (
                  <div
                    key={biz.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/marketplace/${biz.slug}`)}
                  >
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {biz.logoUrl ? (
                        <img
                          src={`${API_URL}${biz.logoUrl}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-lg font-bold text-gray-400">
                          {biz.name[0]}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{biz.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {biz.businessType && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: TEAL_LIGHT, color: TEAL }}>
                            {biz.businessType === 'SALON' ? 'Salón' :
                             biz.businessType === 'BARBERIA' ? 'Barbería' :
                             biz.businessType === 'CLINICA' ? 'Clínica' :
                             biz.businessType}
                          </span>
                        )}
                        {biz.averageRating != null && (
                          <div className="flex items-center gap-0.5">
                            <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <span className="text-xs text-gray-600">{biz.averageRating}</span>
                          </div>
                        )}
                      </div>
                      {biz.address && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{biz.address}</p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFavMutation.mutate(biz.slug);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                      title="Quitar de favoritos"
                    >
                      <svg className="w-5 h-5" fill="#008080" stroke="#008080" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Gallery (toggles from Galeria) ────────── */}
        {showGallery && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            {galleryCategories.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-400 text-sm">
                  Aun no tienes fotos de servicios completados
                </p>
              </div>
            ) : (
              <>
                {/* Category pills */}
                <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
                    style={selectedCategory === null
                      ? { backgroundColor: TEAL, color: 'white' }
                      : { backgroundColor: '#f3f4f6', color: '#4b5563' }
                    }
                  >
                    Todas ({galleryCategories.reduce((s, c) => s + c.photos.length, 0)})
                  </button>
                  {galleryCategories.map((cat) => (
                    <button
                      key={cat.name}
                      onClick={() => setSelectedCategory(cat.name)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
                      style={selectedCategory === cat.name
                        ? { backgroundColor: TEAL, color: 'white' }
                        : { backgroundColor: '#f3f4f6', color: '#4b5563' }
                      }
                    >
                      {cat.name} ({cat.photos.length})
                    </button>
                  ))}
                </div>

                {/* Photo grid */}
                <div className="grid grid-cols-3 gap-2">
                  {filteredPhotos.map((photo) => (
                    <button
                      key={photo.id}
                      onClick={() => setLightboxPhoto(photo)}
                      className="aspect-square rounded-lg overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity"
                    >
                      <img
                        src={`${API_URL}${photo.imageUrl}`}
                        alt={photo.serviceName}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── Upcoming Appointments ─────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Proximas citas</h2>
          </div>

          {upcomingLoading ? (
            <div className="text-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 mx-auto" style={{ borderColor: TEAL }} />
            </div>
          ) : upcomingAppointments.length === 0 ? (
            <div className="text-center py-6 bg-white rounded-xl border border-gray-200">
              <p className="text-gray-400 text-sm">No tienes citas proximas</p>
              <Link
                href="/marketplace"
                className="text-sm font-medium mt-2 inline-block"
                style={{ color: TEAL }}
              >
                Buscar negocios
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingAppointments.map((apt) => (
                <AppointmentCard key={apt.id} apt={apt} />
              ))}
            </div>
          )}
        </div>

        {/* ─── Mis cupones ────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Mis cupones</h2>
          {myRewards.length === 0 ? (
            <div className="text-center py-6 bg-white rounded-xl border border-gray-200">
              <svg className="w-8 h-8 mx-auto text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
              </svg>
              <p className="text-gray-400 text-sm">No tienes cupones canjeados</p>
              <p className="text-xs text-gray-300 mt-1">Canjea puntos en los negocios que visitas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {myRewards.map((r: any) => {
                const statusColors: Record<string, string> = {
                  ACTIVE: 'bg-green-50 text-green-700',
                  USED: 'bg-gray-100 text-gray-500',
                  EXPIRED: 'bg-red-50 text-red-600',
                };
                const statusLabels: Record<string, string> = {
                  ACTIVE: 'Activo',
                  USED: 'Usado',
                  EXPIRED: 'Expirado',
                };
                return (
                  <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{r.reward?.name}</p>
                        <p className="text-xs text-gray-500">{r.tenant?.name}</p>
                      </div>
                      <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${statusColors[r.status] || 'bg-gray-100 text-gray-600'}`}>
                        {statusLabels[r.status] || r.status}
                      </span>
                    </div>
                    {r.status === 'ACTIVE' && (
                      <div className="flex items-center gap-2 mt-2 p-2 rounded-lg" style={{ backgroundColor: TEAL_LIGHT }}>
                        <svg className="w-4 h-4 flex-shrink-0" style={{ color: TEAL }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
                        </svg>
                        <span className="font-mono text-sm font-bold tracking-widest" style={{ color: TEAL }}>{r.code}</span>
                      </div>
                    )}
                    {r.expiresAt && r.status === 'ACTIVE' && (
                      <p className="text-[10px] text-gray-400 mt-1.5">
                        Expira: {dayjs(r.expiresAt).format('D MMM YYYY')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Logout ────────────────────────────────── */}
        <button
          onClick={handleLogout}
          className="w-full border border-red-200 text-red-600 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
        >
          Cerrar sesion
        </button>
      </div>

      {/* Lightbox */}
      {lightboxPhoto && (
        <GalleryLightbox
          photo={lightboxPhoto}
          onClose={() => setLightboxPhoto(null)}
        />
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';
import { signOutAll } from '@/lib/sign-out-all';
import { marketplaceApi } from '@/lib/marketplace-api';
import { formatCurrency, resolveImageUrl } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';

dayjs.locale('es');

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TEAL = '#008080';
const TEAL_DARK = '#006666';
const TEAL_LIGHT = '#e0f2f1';

function formatExpiry(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysLeft(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-50 text-yellow-700' },
  CONFIRMED: { label: 'Confirmada', color: 'bg-blue-50 text-blue-700' },
  RESCHEDULED: { label: 'Reagendada', color: 'bg-orange-50 text-orange-700' },
  IN_PROGRESS: { label: 'En curso', color: 'bg-purple-50 text-purple-700' },
  COMPLETED: { label: 'Completada', color: 'bg-green-50 text-green-700' },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-50 text-red-700' },
  NO_SHOW: { label: 'Ausente', color: 'bg-gray-100 text-gray-600' },
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
    address?: string | null;
    locations?: { id: string; name: string; address?: string | null; latitude?: number | null; longitude?: number | null }[];
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
  payments?: {
    id: string;
    status: string;
    paymentMethod: string;
    totalAmount: string | number;
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

// ─── Helpers ───────────────────────────────────────────

function relativeTime(isoString: string): { label: string; urgent: boolean } {
  const now = dayjs();
  const dt = dayjs(isoString);
  const diffMins = dt.diff(now, 'minute');
  const diffHours = dt.diff(now, 'hour');
  const diffDays = dt.diff(now, 'day');

  if (diffMins < 0) return { label: 'Ahora', urgent: true };
  if (diffMins < 60) return { label: `En ${diffMins} min`, urgent: true };
  if (diffHours < 24) return { label: `Hoy a las ${dt.format('h:mm A')}`, urgent: true };
  if (diffDays === 1) return { label: `Mañana a las ${dt.format('h:mm A')}`, urgent: false };
  if (diffDays <= 6) return { label: `En ${diffDays} días`, urgent: false };
  return { label: dt.format('D [de] MMM'), urgent: false };
}

function calcDistanceKm(
  userGps: { lat: number; lng: number } | null,
  lat?: number | null,
  lng?: number | null,
): number | null {
  if (!userGps || !lat || !lng) return null;
  const R = 6371;
  const dLat = ((lat - userGps.lat) * Math.PI) / 180;
  const dLng = ((lng - userGps.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((userGps.lat * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Appointment Card ──────────────────────────────────

function AppointmentCard({
  apt,
  userGps,
}: {
  apt: Appointment;
  userGps: { lat: number; lng: number } | null;
}) {
  const router = useRouter();
  const status = STATUS_CONFIG[apt.status] || {
    label: apt.status,
    color: 'bg-gray-100 text-gray-600',
  };
  const totalPrice = apt.items.reduce(
    (sum, item) => sum + Number(item.priceSnapshot || 0),
    0,
  );
  const totalDuration = apt.items.reduce(
    (sum, item) => sum + (item.durationSnapshot || 0),
    0,
  );
  const isUpcoming = ['PENDING', 'CONFIRMED', 'RESCHEDULED'].includes(apt.status);
  const relative = isUpcoming ? relativeTime(apt.startTime) : null;

  // Distance: try first location, fallback to tenant address coords (none if no GPS data)
  const loc = apt.tenant.locations?.[0];
  const distKm = calcDistanceKm(userGps, loc?.latitude, loc?.longitude);
  const distLabel = distKm !== null
    ? distKm < 1
      ? `${Math.round(distKm * 1000)} m`
      : `${distKm.toFixed(1)} km`
    : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {/* Header: business + status */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
        <Link
          href={`/marketplace/${apt.tenant.slug}`}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
            {apt.tenant.logoUrl ? (
              <img src={`${API_URL}${apt.tenant.logoUrl}`} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-gray-400">{apt.tenant.name[0]}</span>
            )}
          </div>
          <span className="text-xs font-semibold text-gray-700">{apt.tenant.name}</span>
        </Link>
        <div className="flex items-center gap-1.5">
          {apt.payments?.[0] && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              apt.payments[0].status === 'COMPLETED'
                ? 'bg-green-100 text-green-700'
                : apt.payments[0].status === 'PENDING'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-600'
            }`}>
              {apt.payments[0].status === 'COMPLETED' ? 'Pagado' :
               apt.payments[0].status === 'PENDING' ? 'Pago pendiente' :
               apt.payments[0].status === 'REFUNDED' ? 'Reembolsado' : apt.payments[0].status}
            </span>
          )}
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Time info row */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {dayjs(apt.startTime).format('ddd, D [de] MMM YYYY')}
          </p>
          <p className="text-xs text-gray-500">
            {dayjs(apt.startTime).format('h:mm A')} – {dayjs(apt.endTime).format('h:mm A')}
            {totalDuration > 0 && (
              <span className="ml-1.5 text-gray-400">
                · {totalDuration >= 60
                  ? `${Math.floor(totalDuration / 60)}h${totalDuration % 60 > 0 ? ` ${totalDuration % 60}m` : ''}`
                  : `${totalDuration}min`}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {relative && (
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                relative.urgent
                  ? 'bg-red-50 text-red-600'
                  : 'text-white'
              }`}
              style={relative.urgent ? {} : { backgroundColor: TEAL }}
            >
              {relative.label}
            </span>
          )}
          {distLabel && (
            <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              {distLabel}
            </span>
          )}
        </div>
      </div>

      {/* Employee + services */}
      <button
        onClick={() => router.push(`/marketplace/${apt.tenant.slug}/professional/${apt.employee.id}`)}
        className="flex items-center gap-3 w-full text-left"
      >
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
          {formatCurrency(totalPrice, (apt.tenant as any)?.currency || 'MXN')}
        </span>
      </button>
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

type ActiveSection = 'default' | 'services' | 'favorites' | 'gallery' | 'points';

export default function MarketplaceProfilePage() {
  const { user, isAuthenticated, isLoading: authLoading, logout, refreshUser } =
    useMarketplaceAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<ActiveSection>('default');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<GalleryCategory['photos'][0] | null>(null);
  const [userGps, setUserGps] = useState<{ lat: number; lng: number } | null>(null);

  // helpers
  const toggle = (section: ActiveSection) =>
    setActiveSection((prev) => (prev === section ? 'default' : section));

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/marketplace/login?redirect=/marketplace/profile');
    }
  }, [authLoading, isAuthenticated, router]);

  // Get user GPS for distance calculation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { timeout: 5000 },
      );
    }
  }, []);

  // Stats
  const { data: statsData } = useQuery({
    queryKey: ['marketplace-my-stats'],
    queryFn: () => marketplaceApi.get<{ data: Stats }>('/my-stats'),
    enabled: isAuthenticated,
  });
  const stats: Stats = (statsData as any)?.data || { totalServices: 0, totalPoints: 0, totalPhotos: 0 };

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

  // Available rewards (from visited businesses)
  const { data: availableRewardsData } = useQuery({
    queryKey: ['marketplace-available-rewards'],
    queryFn: () => marketplaceApi.get<{ data: any[] }>('/available-rewards'),
    enabled: isAuthenticated,
  });
  const availableRewards: any[] = (availableRewardsData as any)?.data || [];

  // Favorites — solo el conteo, el listado vive en /marketplace?favorites=1
  const { data: favoritesData } = useQuery({
    queryKey: ['marketplace-my-favorites'],
    queryFn: () => marketplaceApi.get<{ data: FavoriteBusiness[] }>('/my-favorites'),
    enabled: isAuthenticated,
  });
  const favorites: FavoriteBusiness[] = (favoritesData as any)?.data || [];

  const filteredPhotos = selectedCategory
    ? galleryCategories.find((c) => c.name === selectedCategory)?.photos || []
    : galleryCategories.flatMap((c) => c.photos);

  const handleLogout = async () => {
    // Cierra TODAS las sesiones (admin/staff, marketplace, portal) y
    // elimina el selector persistido. Sin esto el usuario que pasó por
    // el selector queda con sesión admin viva y /login restaura el
    // selector en vez del form de login.
    await signOutAll();
    router.push('/login');
  };

  // Sin logout: lleva al /login para que el sistema muestre el selector
  // de perfil (cliente/profesional/administrador) si la sesión sigue
  // viva, o el formulario de login si necesita autenticarse de nuevo.
  const handleChangeProfile = () => {
    router.push('/login');
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
    <div className="min-h-screen bg-gray-50 safe-top">


      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* ─── Hero Card ─────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center relative">
          {/* Modo oscuro removido en V1 — pendiente para V2 (requiere
              auditar todos los componentes del marketplace para
              asegurar contraste/legibilidad). Ver
              project_v2_dark_mode.md. */}
          <div className="absolute top-4 right-4 flex items-center gap-1">
            <Link
              href="/marketplace/settings"
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Configuración"
            >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            </Link>
          </div>
          {/* Avatar — click to edit profile */}
          <Link href="/marketplace/settings" className="block mx-auto mb-3 relative w-20 h-20 group">
            <Avatar
              avatarUrl={user.avatarUrl}
              firstName={user.firstName}
              lastName={user.lastName}
              className="w-20 h-20"
              textClassName="text-2xl"
            />
            <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
              </svg>
            </div>
          </Link>

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
        <div className="grid grid-cols-3 gap-3">
          {/* Servicios: solo dato, no accionable — el listado de citas
              pasadas vive en /marketplace/appointments (tab Citas). */}
          <div
            className="rounded-xl border p-4 text-center"
            style={{ backgroundColor: 'white', borderColor: '#e5e7eb' }}
          >
            <p className="text-2xl font-bold" style={{ color: TEAL }}>
              {stats.totalServices}
            </p>
            <p className="text-xs text-gray-500 mt-1">Servicios</p>
          </div>
          {/* Favoritos: lleva a /marketplace?favorites=1 — el listado vive
              ahi (Negocios con filtro de favoritos activo), no en el perfil. */}
          <button
            onClick={() => router.push('/marketplace?favorites=1')}
            className="rounded-xl border p-4 text-center transition-all hover:bg-gray-50"
            style={{ backgroundColor: 'white', borderColor: '#e5e7eb' }}
          >
            <p className="text-2xl font-bold" style={{ color: TEAL }}>
              {favorites.length}
            </p>
            <p className="text-xs text-gray-500 mt-1">Favoritos</p>
          </button>
          <button
            onClick={() => router.push('/marketplace/gallery')}
            className="rounded-xl p-4 text-center transition-colors text-white"
            style={{ backgroundColor: TEAL }}
          >
            <svg className="w-6 h-6 mx-auto mb-1" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A1.5 1.5 0 0 0 21.75 19.5V4.5A1.5 1.5 0 0 0 20.25 3H3.75A1.5 1.5 0 0 0 2.25 4.5v15A1.5 1.5 0 0 0 3.75 21Z" />
            </svg>
            <p className="text-xs font-medium">Galería</p>
          </button>
        </div>

        {/* Servicios: el dato vive solo en el grid de arriba. La historia
            de citas pasadas se muestra en /marketplace/appointments. */}

        {/* Favoritos: el listado vive en /marketplace?favorites=1 (no aqui). */}

        {/* ─── Gallery (toggles from Galeria) ────────── */}
        {activeSection === 'gallery' && (
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

        {/* Próximas citas y cupones se ven en sus secciones dedicadas */}
        {activeSection === 'default' && (
          <div className="space-y-3"></div>
        )}

        {/* Quick link "Historial de Pagos" eliminado del perfil. Los pagos
            ahora viven como tercera pestaña dentro de /marketplace/appointments
            (Citas | Compras | Pagos). */}

        {/* ─── Cambiar perfil + Logout ─────────────────── */}
        {activeSection === 'default' && (
          <div className="space-y-2">
            <button
              onClick={handleChangeProfile}
              className="w-full border border-gray-200 bg-white text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cambiar perfil
            </button>
            <button
              onClick={handleLogout}
              className="w-full border border-red-200 text-red-600 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        )}
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

function ProfileCouponCard({ redemption, disabled = false }: { redemption: any; disabled?: boolean }) {
  const reward = redemption.reward;
  const tenant = redemption.tenant;
  const isDiscount = reward?.type === 'DESCUENTO';
  const expiry = formatExpiry(redemption.expiresAt);
  const days = daysLeft(redemption.expiresAt);
  const isUrgent = days !== null && days <= 7 && !disabled;

  const valueLabel = isDiscount
    ? (reward?.discountMode === 'PERCENT'
      ? `-${Number(reward.discountAmount)}%`
      : `$${reward?.discountAmount ?? ''}`)
    : 'GRATIS';

  const statusLabel = redemption.status === 'USED' ? 'USADO' : 'VENCIDO';
  const displayLabel = disabled ? statusLabel : valueLabel;
  const stubFontSize = displayLabel.length <= 4 ? '1.125rem' : displayLabel.length <= 6 ? '0.875rem' : '0.75rem';

  return (
    <div
      className="relative"
      style={{ filter: disabled ? 'grayscale(0.5)' : undefined, opacity: disabled ? 0.65 : 1 }}
    >
      <div className="bg-white rounded-2xl overflow-hidden shadow-md flex" style={{ minHeight: 110 }}>

        {/* Stub izquierdo */}
        <div
          className="w-20 flex-shrink-0 flex flex-col items-center justify-center gap-0.5 relative"
          style={{ backgroundColor: disabled ? '#9ca3af' : '#008080' }}
        >
          <span
            className="text-white font-black leading-tight text-center break-all w-full px-2"
            style={{ fontSize: stubFontSize, wordBreak: 'break-all' }}
          >
            {displayLabel}
          </span>
          {!disabled && (
            <span className="text-white/70 text-[9px] uppercase tracking-wider">
              {isDiscount ? 'descuento' : 'servicio'}
            </span>
          )}
          <div className="absolute -right-3 -top-3 w-6 h-6 rounded-full" style={{ backgroundColor: '#f3f4f6' }} />
          <div className="absolute -right-3 -bottom-3 w-6 h-6 rounded-full" style={{ backgroundColor: '#f3f4f6' }} />
        </div>

        {/* Separador perforado */}
        <div className="flex flex-col items-center justify-center w-4 flex-shrink-0 gap-[3px] py-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="w-[3px] h-[3px] rounded-full" style={{ backgroundColor: '#d1d5db' }} />
          ))}
        </div>

        {/* Contenido principal */}
        <div className="flex-1 py-3 pr-4 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-gray-900 leading-tight truncate">{reward?.name || 'Cupón'}</p>
              {tenant && (
                <span className="text-[10px] font-medium text-[#008080] bg-teal-50 px-2 py-0.5 rounded-full flex-shrink-0 truncate max-w-[120px]">
                  {tenant.name}
                </span>
              )}
            </div>
            {reward && (
              <p className="text-xs text-gray-500 mt-0.5">
                {isDiscount
                  ? (reward.discountMode === 'PERCENT'
                    ? `${Number(reward.discountAmount)}% de descuento`
                    : `$${reward.discountAmount} de descuento`)
                  : (reward.service?.name ? `${reward.service.name} gratis` : 'Servicio gratis')}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between mt-2 gap-2">
            {expiry && (
              <div
                className="flex items-center gap-1 px-2 py-1 rounded-lg flex-shrink-0"
                style={isUrgent ? { backgroundColor: '#fef2f2', color: '#dc2626' } : { backgroundColor: '#f3f4f6', color: '#6b7280' }}
              >
                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[10px] font-semibold whitespace-nowrap">
                  {isUrgent ? `¡Vence en ${days}d!` : `Vence ${expiry}`}
                </span>
              </div>
            )}
            {!disabled ? (
              <Link
                href={tenant?.slug ? `/marketplace/${tenant.slug}` : '/marketplace'}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-black tracking-wide text-white transition-transform active:scale-95"
                style={{ backgroundColor: '#008080', letterSpacing: '0.05em' }}
              >
                CANJEAR
              </Link>
            ) : (
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {statusLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

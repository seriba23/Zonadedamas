'use client';

import { useState, useEffect, useRef } from 'react';
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
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ backgroundColor: apt.employee.color || TEAL }}
        >
          {apt.employee.firstName[0]}
          {apt.employee.lastName[0]}
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

function ContactChangeForm({
  field,
  label,
  currentValue,
  type,
  onSuccess,
  onCancel,
}: {
  field: 'email' | 'phone';
  label: string;
  currentValue: string;
  type: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      marketplaceApi.put('/auth/profile/contact', {
        [field]: value,
        currentPassword: password,
      }),
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: any) => {
      setError(err.message || 'Error al actualizar');
    },
  });

  return (
    <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
      <p className="text-xs text-gray-500">Actual: {currentValue}</p>
      <input
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`Nuevo ${label.toLowerCase()}`}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
        style={{ '--tw-ring-color': TEAL } as any}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Contrasena actual (requerida)"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
        style={{ '--tw-ring-color': TEAL } as any}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => mutation.mutate()}
          disabled={!value || !password || mutation.isPending}
          className="flex-1 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          style={{ backgroundColor: TEAL }}
        >
          {mutation.isPending ? 'Verificando...' : 'Confirmar'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Edit Profile Panel ────────────────────────────────

function EditProfilePanel({
  user,
  onClose,
  onSaved,
}: {
  user: { firstName: string; lastName: string; email: string; phone: string | null; avatarUrl?: string | null };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [changingField, setChangingField] = useState<'email' | 'phone' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profileMutation = useMutation({
    mutationFn: () => marketplaceApi.put('/auth/profile', form),
    onSuccess: () => {
      setSuccess('Perfil actualizado');
      setError('');
      onSaved();
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err: any) => {
      setError(err.message || 'Error al actualizar');
      setSuccess('');
    },
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => marketplaceApi.uploadFile('/auth/avatar', file),
    onSuccess: () => {
      setAvatarPreview(null);
      onSaved();
    },
    onError: (err: any) => {
      setError(err.message || 'Error al subir foto');
    },
  });

  const passwordMutation = useMutation({
    mutationFn: () =>
      marketplaceApi.put('/auth/profile/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      }),
    onSuccess: () => {
      setPasswordSuccess('Contrasena actualizada');
      setPasswordError('');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPasswordSuccess(''), 3000);
    },
    onError: (err: any) => {
      setPasswordError(err.message || 'Error al cambiar contrasena');
      setPasswordSuccess('');
    },
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    avatarMutation.mutate(file);
  };

  const handlePasswordSubmit = () => {
    setPasswordError('');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Las contrasenas no coinciden');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Minimo 8 caracteres');
      return;
    }
    if (!/[0-9]/.test(passwordForm.newPassword)) {
      setPasswordError('Debe contener al menos un numero');
      return;
    }
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?/~`]/.test(passwordForm.newPassword)) {
      setPasswordError('Debe contener al menos un simbolo');
      return;
    }
    passwordMutation.mutate();
  };

  const initials = `${(user.firstName || '')[0] || ''}${(user.lastName || '')[0] || ''}`.toUpperCase();
  const avatarSrc = avatarPreview || (user.avatarUrl ? `${API_URL}${user.avatarUrl}` : null);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Editar mi perfil</p>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Avatar upload */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="relative w-16 h-16 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 group"
          style={{ backgroundColor: TEAL_LIGHT }}
        >
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl font-bold" style={{ color: TEAL }}>{initials}</span>
          )}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
            </svg>
          </div>
          {avatarMutation.isPending && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-full">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2" style={{ borderColor: TEAL }} />
            </div>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleAvatarChange}
        />
        <div>
          <p className="text-sm font-medium text-gray-700">Foto de perfil</p>
          <p className="text-xs text-gray-400">JPG, PNG o WebP. Max 5MB</p>
        </div>
      </div>

      {/* Name fields */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nombre</label>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
              style={{ '--tw-ring-color': TEAL } as any}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Apellido</label>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
              style={{ '--tw-ring-color': TEAL } as any}
            />
          </div>
        </div>

        {/* Email — read-only with "Cambiar" */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-gray-500">Email</label>
            {changingField !== 'email' && (
              <button
                onClick={() => { setChangingField('email'); }}
                className="text-xs font-medium hover:underline"
                style={{ color: TEAL }}
              >
                Cambiar
              </button>
            )}
          </div>
          {changingField === 'email' ? (
            <ContactChangeForm
              field="email"
              label="Email"
              currentValue={user.email}
              type="email"
              onSuccess={() => { setChangingField(null); onSaved(); }}
              onCancel={() => setChangingField(null)}
            />
          ) : (
            <p className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
              {user.email}
            </p>
          )}
        </div>

        {/* Phone — read-only with "Cambiar" */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-gray-500">Telefono</label>
            {changingField !== 'phone' && (
              <button
                onClick={() => { setChangingField('phone'); }}
                className="text-xs font-medium hover:underline"
                style={{ color: TEAL }}
              >
                Cambiar
              </button>
            )}
          </div>
          {changingField === 'phone' ? (
            <ContactChangeForm
              field="phone"
              label="Telefono"
              currentValue={user.phone || 'No registrado'}
              type="tel"
              onSuccess={() => { setChangingField(null); onSaved(); }}
              onCancel={() => setChangingField(null)}
            />
          ) : (
            <p className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
              {user.phone || 'No registrado'}
            </p>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">{success}</p>
      )}

      <button
        onClick={() => profileMutation.mutate()}
        disabled={profileMutation.isPending}
        className="w-full text-white py-2.5 rounded-lg font-medium text-sm disabled:opacity-50 transition-colors"
        style={{ backgroundColor: TEAL }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = TEAL_DARK)}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL)}
      >
        {profileMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
      </button>

      {/* Change password (collapsible) */}
      <div className="border-t border-gray-100 pt-4">
        <button
          onClick={() => setShowPasswordSection(!showPasswordSection)}
          className="w-full flex items-center justify-between"
        >
          <p className="text-sm font-medium text-gray-700">Cambiar contrasena</p>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${
              showPasswordSection ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showPasswordSection && (
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Contrasena actual
              </label>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
                style={{ '--tw-ring-color': TEAL } as any}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Nueva contrasena
              </label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
                style={{ '--tw-ring-color': TEAL } as any}
                placeholder="Min. 8 caracteres, 1 numero, 1 simbolo"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Confirmar nueva contrasena
              </label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
                style={{ '--tw-ring-color': TEAL } as any}
              />
            </div>

            {passwordError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                {passwordError}
              </p>
            )}
            {passwordSuccess && (
              <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                {passwordSuccess}
              </p>
            )}

            <button
              onClick={handlePasswordSubmit}
              disabled={passwordMutation.isPending}
              className="w-full text-white py-2.5 rounded-lg font-medium text-sm disabled:opacity-50 transition-colors"
              style={{ backgroundColor: TEAL }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = TEAL_DARK)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL)}
            >
              {passwordMutation.isPending ? 'Cambiando...' : 'Cambiar contrasena'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Profile Page ─────────────────────────────────

export default function MarketplaceProfilePage() {
  const { user, isAuthenticated, isLoading: authLoading, logout, refreshUser } =
    useMarketplaceAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showEditProfile, setShowEditProfile] = useState(false);
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
        <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
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

          <button
            onClick={() => setShowEditProfile(!showEditProfile)}
            className="mt-4 px-5 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            {showEditProfile ? 'Cerrar editor' : 'Editar mi perfil'}
          </button>
        </div>

        {/* ─── Edit Profile (expandable) ─────────────── */}
        {showEditProfile && (
          <EditProfilePanel
            user={user}
            onClose={() => setShowEditProfile(false)}
            onSaved={() => refreshUser()}
          />
        )}

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

'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Modal } from '@/components/ui/modal';
import { ImageUpload } from '@/components/ui/image-upload';
import { StarRating } from '@/components/staff/star-rating';
import { ReviewCard } from '@/components/staff/review-card';
import { ReviewForm } from '@/components/staff/review-form';
import { PortfolioGallery } from '@/components/staff/portfolio-gallery';
import { EmployeePersonalInfo } from '@/components/staff/employee-personal-info';
import { EmployeeTraining } from '@/components/staff/employee-training';
import { EmployeePermissions } from '@/components/staff/employee-permissions';
import { EmployeeServicesEditor } from '@/components/staff/employee-services-editor';
import { formatCurrency, formatDate, getInitials } from '@/lib/utils';
import { usePermissions } from '@/lib/hooks/use-permissions';
import dayjs from 'dayjs';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  color?: string;
  bio?: string;
  avatarUrl?: string | null;
  bloodType?: string | null;
  emergencyContactName?: string | null;
  emergencyContactLastName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  allergies?: string | null;
  userId?: string | null;
  isActive: boolean;
  createdAt: string;
  location?: { id: string; name: string };
  employeeServices?: Array<{
    serviceId: string;
    service: { id: string; name: string };
  }>;
  schedules?: Array<{
    dayOfWeek: string;
    isWorking: boolean;
    startTime: string;
    endTime: string;
  }>;
  _count?: { portfolioImages: number; reviews: number; documents: number; trainings: number };
}

interface EmployeeStats {
  completedAllTime: number;
  completedThisMonth: number;
  cancelledCount: number;
  noShowCount: number;
  cancellationRate: number;
  totalRevenue: number;
  averageRating: number | null;
  totalReviews: number;
  topServices: Array<{ serviceName: string; count: number }>;
  upcomingAppointments: Array<{
    id: string;
    startTime: string;
    endTime: string;
    status: string;
    client: { id: string; firstName: string; lastName: string };
    items: Array<{
      serviceNameSnapshot: string;
      priceSnapshot: number;
      durationSnapshot: number;
    }>;
  }>;
}

interface Review {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  client: { firstName: string; lastName: string };
  appointment: {
    id: string;
    startTime: string;
    items: Array<{ serviceNameSnapshot: string }>;
  };
}

interface ReviewsData {
  reviews: Review[];
  averageRating: number | null;
  totalReviews: number;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
}

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Lun',
  TUESDAY: 'Mar',
  WEDNESDAY: 'Mié',
  THURSDAY: 'Jue',
  FRIDAY: 'Vie',
  SATURDAY: 'Sáb',
  SUNDAY: 'Dom',
};

type ProfileTab = 'estadisticas' | 'servicios' | 'portfolio' | 'formacion' | 'resenas' | 'info_personal' | 'permisos';

export default function EmployeeProfilePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const employeeId = params.id as string;
  const [activeTab, setActiveTab] = useState<ProfileTab>('estadisticas');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);

  const canEdit = hasPermission('employees.update');

  const { data: employeeData, isLoading: loadingEmployee } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => api.get<{ data: Employee }>(`/api/employees/${employeeId}`),
    enabled: !!employeeId,
  });

  const { data: statsData, isLoading: loadingStats } = useQuery({
    queryKey: ['employee-stats', employeeId],
    queryFn: () => api.get<{ data: EmployeeStats }>(`/api/employees/${employeeId}/stats`),
    enabled: !!employeeId,
  });

  const { data: reviewsData } = useQuery({
    queryKey: ['employee-reviews', employeeId],
    queryFn: () => api.get<{ data: ReviewsData }>(`/api/employees/${employeeId}/reviews`),
    enabled: !!employeeId && activeTab === 'resenas',
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) =>
      api.upload(`/api/employees/${employeeId}/avatar`, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setAvatarSuccess('Fotografía cargada con éxito');
      setTimeout(() => setAvatarSuccess(null), 3000);
    },
  });

  const employee = employeeData?.data;
  const stats = statsData?.data;
  const reviews = reviewsData?.data;

  if (loadingEmployee) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Perfil de Empleado" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Empleado no encontrado" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-gray-500">No se encontró el empleado solicitado.</p>
          <button onClick={() => router.push('/staff')} className="btn-primary">
            Volver a Personal
          </button>
        </div>
      </div>
    );
  }

  const empColor = employee.color || '#008080';
  const rgb = hexToRgb(empColor);
  const avatarBg = rgb
    ? { backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`, color: empColor }
    : { backgroundColor: 'rgba(0, 128, 128, 0.15)', color: '#008080' };

  const services = employee.employeeServices?.map((es) => es.service) || [];

  const workingDays = (employee.schedules || [])
    .filter((s) => s.isWorking)
    .map((s) => DAY_LABELS[s.dayOfWeek] || s.dayOfWeek);

  const tabs: { key: ProfileTab; label: string }[] = [
    { key: 'estadisticas', label: 'Estadísticas' },
    { key: 'servicios', label: 'Servicios' },
    { key: 'portfolio', label: 'Portfolio' },
    { key: 'formacion', label: 'Formación' },
    { key: 'resenas', label: 'Reseñas' },
    { key: 'info_personal', label: 'Info Personal' },
    ...(hasPermission('roles.read')
      ? [{ key: 'permisos' as ProfileTab, label: 'Permisos' }]
      : []),
  ];

  return (
    <div className="flex flex-col h-full">
      <Header title="Perfil de Empleado" />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Back + Edit */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.push('/staff')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a Personal
          </button>
        </div>

        {/* Header Card */}
        <div
          className="bg-white rounded-xl border border-gray-200 p-6 mb-6 border-l-4"
          style={{ borderLeftColor: empColor }}
        >
          <div className="flex items-start gap-5">
            {/* Avatar with upload */}
            {canEdit ? (
              <ImageUpload
                currentImage={employee.avatarUrl}
                uploading={avatarMutation.isPending}
                className="w-20 h-20 flex-shrink-0"
                successMessage={avatarSuccess}
                placeholder={
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold"
                    style={avatarBg}
                  >
                    {getInitials(employee.firstName, employee.lastName)}
                  </div>
                }
                onSelect={(file) => avatarMutation.mutate(file)}
              />
            ) : (
              <EmployeeAvatar
                avatarUrl={employee.avatarUrl}
                firstName={employee.firstName}
                lastName={employee.lastName}
                avatarBg={avatarBg}
                size="w-20 h-20"
                textSize="text-2xl"
              />
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-900">
                  {employee.firstName} {employee.lastName}
                </h1>
                {!employee.isActive && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    Inactivo
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                {employee.email && <span>{employee.email}</span>}
                {employee.phone && <span>{employee.phone}</span>}
              </div>

              {/* Rating summary */}
              {stats && stats.averageRating !== null && (
                <div className="flex items-center gap-2 mt-2">
                  <StarRating rating={stats.averageRating} size="sm" />
                  <span className="text-sm font-medium text-gray-700">
                    {stats.averageRating}
                  </span>
                  <span className="text-sm text-gray-400">
                    ({stats.totalReviews} reseña{stats.totalReviews !== 1 ? 's' : ''})
                  </span>
                </div>
              )}

              <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                {employee.location && <span>{employee.location.name}</span>}
              </div>

              {employee.bio && (
                <p className="text-sm text-gray-600 mt-3 italic">
                  &quot;{employee.bio}&quot;
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Estadísticas */}
        {activeTab === 'estadisticas' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Stats cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="Citas completadas"
                  value={stats?.completedAllTime ?? '-'}
                  sub={stats ? `${stats.completedThisMonth} este mes` : undefined}
                  loading={loadingStats}
                />
                <StatCard
                  label="Ingresos totales"
                  value={stats ? formatCurrency(stats.totalRevenue) : '-'}
                  loading={loadingStats}
                />
                <StatCard
                  label="Cancelaciones"
                  value={stats?.cancelledCount ?? '-'}
                  sub={stats ? `${stats.cancellationRate}% tasa` : undefined}
                  loading={loadingStats}
                />
                <StatCard
                  label="No-show"
                  value={stats?.noShowCount ?? '-'}
                  loading={loadingStats}
                />
              </div>

              {/* Top services */}
              {stats && stats.topServices.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-900 mb-3">Top servicios</h3>
                  <div className="space-y-2">
                    {stats.topServices.map((svc, i) => {
                      const maxCount = stats.topServices[0].count;
                      const pct = maxCount > 0 ? (svc.count / maxCount) * 100 : 0;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-sm text-gray-700 w-40 truncate flex-shrink-0">
                            {svc.serviceName}
                          </span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: empColor }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right flex-shrink-0">
                            {svc.count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Upcoming appointments */}
              {stats && stats.upcomingAppointments.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-900 mb-3">Próximas citas</h3>
                  <div className="space-y-3">
                    {stats.upcomingAppointments.map((apt) => (
                      <div
                        key={apt.id}
                        className="flex items-center gap-4 p-3 rounded-lg bg-gray-50"
                      >
                        <div className="text-center flex-shrink-0 w-12">
                          <p className="text-xs text-gray-400">
                            {dayjs(apt.startTime).format('MMM')}
                          </p>
                          <p className="text-lg font-bold text-gray-900">
                            {dayjs(apt.startTime).format('DD')}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {apt.client.firstName} {apt.client.lastName}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {apt.items.map((it) => it.serviceNameSnapshot).join(', ')}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm text-gray-700">
                            {dayjs(apt.startTime).format('h:mm A')}
                          </p>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded-full ${
                              apt.status === 'CONFIRMED'
                                ? 'bg-green-50 text-green-700'
                                : 'bg-yellow-50 text-yellow-700'
                            }`}
                          >
                            {apt.status === 'CONFIRMED' ? 'Confirmada' : 'Pendiente'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats &&
                stats.upcomingAppointments.length === 0 &&
                stats.topServices.length === 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <p className="text-gray-500">
                      Este empleado aún no tiene citas registradas.
                    </p>
                  </div>
                )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Info card */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Información</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs">Miembro desde</p>
                    <p className="text-gray-700">
                      {formatDate(employee.createdAt, 'D MMM YYYY')}
                    </p>
                  </div>
                  {workingDays.length > 0 && (
                    <div>
                      <p className="text-gray-400 text-xs">Días laborales</p>
                      <p className="text-gray-700">{workingDays.join(', ')}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Services card */}
              {services.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    Servicios ({services.length})
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {services.map((svc) => (
                      <span
                        key={svc.id}
                        className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full"
                      >
                        {svc.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Servicios */}
        {activeTab === 'servicios' && (
          <EmployeeServicesEditor employeeId={employeeId} />
        )}

        {/* Tab: Portfolio */}
        {activeTab === 'portfolio' && (
          <PortfolioGallery employeeId={employeeId} canEdit={canEdit} />
        )}

        {/* Tab: Formación */}
        {activeTab === 'formacion' && (
          <EmployeeTraining employeeId={employeeId} canEdit={canEdit} />
        )}

        {/* Tab: Reseñas */}
        {activeTab === 'resenas' && (
          <div className="space-y-6">
            {/* Summary + Add button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {reviews && reviews.averageRating !== null && (
                  <>
                    <span className="text-3xl font-bold text-gray-900">
                      {reviews.averageRating}
                    </span>
                    <div>
                      <StarRating rating={reviews.averageRating} size="md" />
                      <p className="text-sm text-gray-400 mt-0.5">
                        {reviews.totalReviews} reseña
                        {reviews.totalReviews !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </>
                )}
                {reviews && reviews.averageRating === null && (
                  <p className="text-sm text-gray-400">Sin reseñas aún</p>
                )}
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setShowReviewForm(true)}
                  className="btn-primary"
                >
                  + Agregar reseña
                </button>
              )}
            </div>

            {/* Reviews list */}
            {reviews && reviews.reviews.length > 0 && (
              <div className="space-y-3">
                {reviews.reviews.map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Info Personal */}
        {activeTab === 'info_personal' && (
          <EmployeePersonalInfo
            employeeId={employeeId}
            initialData={{
              firstName: employee.firstName,
              lastName: employee.lastName,
              email: employee.email,
              phone: employee.phone,
              color: employee.color,
              bio: employee.bio,
              bloodType: employee.bloodType,
              emergencyContactName: employee.emergencyContactName,
              emergencyContactLastName: employee.emergencyContactLastName,
              emergencyContactPhone: employee.emergencyContactPhone,
              emergencyContactRelation: employee.emergencyContactRelation,
              allergies: employee.allergies,
            }}
            canEdit={canEdit}
          />
        )}

        {/* Tab: Permisos */}
        {activeTab === 'permisos' && (
          <EmployeePermissions
            employeeId={employeeId}
            canManage={hasPermission('users.manage')}
          />
        )}
      </div>

      {/* Review Form Modal */}
      {showReviewForm && (
        <Modal title="Nueva Reseña" onClose={() => setShowReviewForm(false)}>
          <ReviewForm
            employeeId={employeeId}
            onClose={() => setShowReviewForm(false)}
            onSuccess={() => setShowReviewForm(false)}
          />
        </Modal>
      )}
    </div>
  );
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function EmployeeAvatar({
  avatarUrl,
  firstName,
  lastName,
  avatarBg,
  size = 'w-14 h-14',
  textSize = 'text-lg',
}: {
  avatarUrl?: string | null;
  firstName: string;
  lastName: string;
  avatarBg: React.CSSProperties;
  size?: string;
  textSize?: string;
}) {
  if (avatarUrl) {
    const src = avatarUrl.startsWith('http') ? avatarUrl : `${API_URL}${avatarUrl}`;
    return (
      <img
        src={src}
        alt={`${firstName} ${lastName}`}
        className={`${size} rounded-full object-cover flex-shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${size} rounded-full flex items-center justify-center ${textSize} font-bold flex-shrink-0`}
      style={avatarBg}
    >
      {getInitials(firstName, lastName)}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  loading,
}: {
  label: string;
  value: string | number;
  sub?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
        <div className="h-3 bg-gray-100 rounded w-20 mb-2" />
        <div className="h-6 bg-gray-100 rounded w-16" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

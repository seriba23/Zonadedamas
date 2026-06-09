'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { ImageUpload } from '@/components/ui/image-upload';
import { CoverCropModal } from '@/components/ui/cover-crop-modal';
import { StarRating } from '@/components/staff/star-rating';
import { ReviewCard } from '@/components/staff/review-card';
import { PortfolioGallery } from '@/components/staff/portfolio-gallery';
import { EmployeePersonalInfo } from '@/components/staff/employee-personal-info';
import { EmployeeTraining } from '@/components/staff/employee-training';
import { EmployeePermissions } from '@/components/staff/employee-permissions';
import { EmployeeServicesEditor } from '@/components/staff/employee-services-editor';
import { formatCurrency, formatDate, getInitials } from '@/lib/utils';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useAuth } from '@/lib/hooks/use-auth';
import dayjs from 'dayjs';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  color?: string;
  bio?: string;
  jobTitle?: string | null;
  avatarUrl?: string | null;
  coverImageUrl?: string | null;
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

interface SmartReassignment {
  appointmentId: string;
  clientName: string;
  services: string[];
  startTime: string;
  endTime: string;
  newEmployeeId: string;
  newEmployeeName: string;
}

interface SmartResult {
  action: 'smart_reschedule';
  reassignedCount: number;
  deactivated: boolean;
  reassignments: SmartReassignment[];
  conflicts: ConflictInfo[];
}

interface ConflictInfo {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  clientName: string;
  services: Array<{ serviceId: string; serviceName: string; durationMinutes: number }>;
  conflictsWith?: { appointmentId: string; startTime: string; endTime: string };
}

interface ReassignResult {
  action: 'reassign';
  reassignedCount: number;
  targetEmployeeId: string;
  deactivated: boolean;
  conflicts: ConflictInfo[];
}

interface SlotInfo {
  startTime: string;
  endTime: string;
  available: boolean;
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
  const { user: authUser } = useAuth();
  const employeeId = params.id as string;
  const [activeTab, setActiveTab] = useState<ProfileTab>('estadisticas');
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);
  const [coverSuccess, setCoverSuccess] = useState<string | null>(null);
  const [coverPendingFile, setCoverPendingFile] = useState<File | null>(null);

  const canEdit = hasPermission('employees.update');
  const canDelete = hasPermission('employees.delete');
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [deactivateAction, setDeactivateAction] = useState<'smart_reschedule' | 'reassign' | 'cancel' | 'keep'>('smart_reschedule');
  const [targetEmployeeId, setTargetEmployeeId] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [loadingPendingCount, setLoadingPendingCount] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  // Smart reschedule result
  const [showSmartResult, setShowSmartResult] = useState(false);
  const [smartResult, setSmartResult] = useState<SmartResult | null>(null);

  // Conflict wizard
  const [showConflictWizard, setShowConflictWizard] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [currentConflictIdx, setCurrentConflictIdx] = useState(0);
  const [reassignTargetId, setReassignTargetId] = useState('');
  const [reassignedBeforeConflicts, setReassignedBeforeConflicts] = useState(0);
  const [wizardMode, setWizardMode] = useState<'reassign' | 'smart'>('reassign');
  const [conflictEmployeeId, setConflictEmployeeId] = useState('');
  const [conflictDate, setConflictDate] = useState('');
  const [conflictSlots, setConflictSlots] = useState<SlotInfo[]>([]);
  const [conflictSelectedSlot, setConflictSelectedSlot] = useState<string | null>(null);
  const [loadingConflictSlots, setLoadingConflictSlots] = useState(false);
  const [conflictCancelReason, setConflictCancelReason] = useState('');
  const [processingConflict, setProcessingConflict] = useState(false);
  const [resolvedConflicts, setResolvedConflicts] = useState<Array<{ id: string; action: string }>>([]);

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

  const toggleActiveMutation = useMutation({
    mutationFn: (isActive: boolean) =>
      api.put(`/api/employees/${employeeId}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setShowDeactivateConfirm(false);
    },
  });

  // Fetch active employees for reassign dropdown
  const { data: allEmployeesData } = useQuery({
    queryKey: ['employees', 'active-for-reassign'],
    queryFn: () => api.get<{ data: Array<{ id: string; firstName: string; lastName: string }> }>('/api/employees?perPage=100'),
    enabled: (showDeactivateConfirm && pendingCount > 0) || showConflictWizard,
  });

  const activeEmployees = (allEmployeesData?.data || []).filter(
    (e: any) => e.id !== employeeId && e.isActive !== false,
  );

  const deactivateMutation = useMutation({
    mutationFn: (body: { action: string; targetEmployeeId?: string; cancelReason?: string }) =>
      api.post<{ data: any }>(`/api/employees/${employeeId}/deactivate`, body),
    onSuccess: (res: any) => {
      const result = res.data;
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setDeactivateError(null);

      if (result.action === 'smart_reschedule') {
        if (result.conflicts?.length > 0) {
          // Has conflicts — show result summary first, then wizard
          setSmartResult(result);
          setConflicts(result.conflicts);
          setReassignedBeforeConflicts(result.reassignedCount || 0);
          setCurrentConflictIdx(0);
          setResolvedConflicts([]);
          setWizardMode('smart');
          setConflictEmployeeId('');
          setShowDeactivateConfirm(false);
          setShowSmartResult(true);
        } else {
          // All reassigned successfully
          setSmartResult(result);
          setShowDeactivateConfirm(false);
          setShowSmartResult(true);
        }
      } else if (result.action === 'reassign' && result.conflicts?.length > 0) {
        setConflicts(result.conflicts);
        setReassignTargetId(result.targetEmployeeId);
        setReassignedBeforeConflicts(result.reassignedCount || 0);
        setCurrentConflictIdx(0);
        setResolvedConflicts([]);
        setWizardMode('reassign');
        setShowDeactivateConfirm(false);
        setShowConflictWizard(true);
      } else {
        setShowDeactivateConfirm(false);
      }
    },
    onError: (err: any) => {
      const msg = err?.message || err?.error || 'Error al desactivar';
      setDeactivateError(msg);
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: () => api.post(`/api/employees/${employeeId}/finalize-deactivation`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setShowConflictWizard(false);
      setConflicts([]);
    },
  });

  const fetchConflictSlots = async (date: string, empId: string, serviceIds: string[]) => {
    setLoadingConflictSlots(true);
    setConflictSelectedSlot(null);
    try {
      const res = await api.post<{ data: { slots: SlotInfo[] } }>('/api/availability/all-slots', {
        employeeId: empId,
        date,
        serviceIds,
      });
      setConflictSlots(res.data?.slots || []);
    } catch {
      setConflictSlots([]);
    }
    setLoadingConflictSlots(false);
  };

  const handleResolveConflict = async (action: 'reschedule' | 'cancel' | 'skip') => {
    const conflict = conflicts[currentConflictIdx];
    if (!conflict) return;
    setProcessingConflict(true);
    const targetEmpId = wizardMode === 'smart' ? conflictEmployeeId : reassignTargetId;
    try {
      if (action === 'reschedule' && conflictSelectedSlot && conflictDate && targetEmpId) {
        await api.post(`/api/appointments/${conflict.id}/reschedule`, {
          startTime: `${conflictDate}T${conflictSelectedSlot}:00Z`,
          employeeId: targetEmpId,
        });
      } else if (action === 'cancel') {
        await api.post(`/api/appointments/${conflict.id}/cancel`, {
          reason: conflictCancelReason || undefined,
        });
      }
      // skip → do nothing

      setResolvedConflicts((prev) => [...prev, { id: conflict.id, action }]);
      queryClient.invalidateQueries({ queryKey: ['appointments'] });

      // Move to next conflict or finish
      if (currentConflictIdx < conflicts.length - 1) {
        setCurrentConflictIdx((prev) => prev + 1);
        setConflictDate('');
        setConflictSlots([]);
        setConflictSelectedSlot(null);
        setConflictCancelReason('');
        setConflictEmployeeId('');
      }
      // If last one, stay on same idx — UI will show summary
    } catch (err: any) {
      setDeactivateError(err?.message || 'Error al resolver conflicto');
    }
    setProcessingConflict(false);
  };

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

  // Si el usuario está en su propio perfil usa /me/cover (sin permiso admin).
  // Si es admin gestionando a otro, usa /:id/cover.
  const coverMutation = useMutation({
    mutationFn: (file: File) => {
      const endpoint =
        employee?.userId === authUser?.id
          ? `/api/employees/me/cover`
          : `/api/employees/${employeeId}/cover`;
      return api.upload(endpoint, file);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setCoverSuccess('Portada cargada con éxito');
      setTimeout(() => setCoverSuccess(null), 3000);
    },
  });

  // Solo admin puede borrar (no hay endpoint /me/cover DELETE).
  const coverDeleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/employees/${employeeId}/cover`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  const employee = employeeData?.data;
  const isOwnProfile = employee?.userId === authUser?.id;
  const stats = statsData?.data;
  const reviews = reviewsData?.data;

  if (loadingEmployee) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex flex-col h-full">
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
    { key: 'portfolio', label: 'Portafolio' },
    { key: 'formacion', label: 'Formación' },
    { key: 'resenas', label: 'Reseñas' },
    { key: 'info_personal', label: 'Info Personal' },
    ...(hasPermission('roles.read')
      ? [{ key: 'permisos' as ProfileTab, label: 'Permisos' }]
      : []),
  ];

  return (
    <div className="flex flex-col h-full">

      <div className="flex-1 overflow-y-auto p-3 md:p-6">
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

        {/* Foto de portada — banda arriba con upload (admin o propio empleado) */}
        {(canEdit || isOwnProfile) && (
          <div className="mb-4">
            <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
              Foto de portada
            </label>
            <div
              className="relative rounded-xl border border-dashed border-[var(--border)] h-32 overflow-hidden bg-cover bg-center group"
              style={
                employee.coverImageUrl
                  ? { backgroundImage: `url(${employee.coverImageUrl.startsWith('http') ? employee.coverImageUrl : `${API_URL}${employee.coverImageUrl}`})` }
                  : { background: `linear-gradient(135deg, ${empColor}, ${empColor}99)` }
              }
            >
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setCoverPendingFile(file);
                  e.target.value = '';
                }}
                disabled={coverMutation.isPending}
                className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-wait"
                aria-label="Subir foto de portada"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <span className="text-white text-sm font-semibold">
                  {coverMutation.isPending ? 'Subiendo...' : employee.coverImageUrl ? 'Cambiar portada' : 'Subir portada'}
                </span>
              </div>
              {employee.coverImageUrl && canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('¿Quitar la foto de portada?')) coverDeleteMutation.mutate();
                  }}
                  disabled={coverDeleteMutation.isPending}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white hover:bg-black/80 flex items-center justify-center"
                  title="Quitar portada"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {coverSuccess && (
              <p className="text-xs text-success-700 mt-1.5">{coverSuccess}</p>
            )}
          </div>
        )}

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

              {employee.jobTitle && (
                <p className="text-sm text-[#008080] font-medium mt-0.5">{employee.jobTitle}</p>
              )}
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

              {/* Deactivate / Reactivate button — owner cannot deactivate themselves */}
              {canDelete && !isOwnProfile && (
                <div className="mt-3">
                  {employee.isActive ? (
                    <button
                      type="button"
                      disabled={loadingPendingCount}
                      onClick={async () => {
                        setLoadingPendingCount(true);
                        setDeactivateError(null);
                        setDeactivateAction('smart_reschedule');
                        setTargetEmployeeId('');
                        setCancelReason('');
                        try {
                          const res = await api.get<{ data: { count: number } }>(`/api/employees/${employeeId}/pending-appointments-count`);
                          setPendingCount(res.data.count);
                        } catch {
                          setPendingCount(0);
                        }
                        setLoadingPendingCount(false);
                        setShowDeactivateConfirm(true);
                      }}
                      className="px-4 py-2 rounded-xl text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      {loadingPendingCount ? 'Verificando...' : 'Desactivar empleado'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleActiveMutation.mutate(true)}
                      disabled={toggleActiveMutation.isPending}
                      className="px-4 py-2 rounded-xl text-sm font-medium border border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-50 transition-colors"
                    >
                      {toggleActiveMutation.isPending ? 'Reactivando...' : 'Reactivar empleado'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Deactivate confirmation dialog */}
        {showDeactivateConfirm && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200">
            <p className="text-sm font-medium text-red-800 mb-1">
              Desactivar a {employee.firstName} {employee.lastName}?
            </p>

            {pendingCount === 0 ? (
              <>
                <p className="text-xs text-red-600 mb-3">
                  El empleado no tiene citas pendientes. Dejará de aparecer en el calendario, filtros y al crear citas. Puedes reactivarlo en cualquier momento.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => deactivateMutation.mutate({ action: 'keep' })}
                    disabled={deactivateMutation.isPending}
                    className="btn-danger text-sm py-1.5 px-4"
                  >
                    {deactivateMutation.isPending ? 'Desactivando...' : 'Confirmar desactivación'}
                  </button>
                  <button
                    onClick={() => { setShowDeactivateConfirm(false); setDeactivateError(null); }}
                    className="btn-secondary text-sm py-1.5 px-4"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-amber-50 border border-amber-200">
                  <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span className="text-sm font-medium text-amber-800">
                    Este empleado tiene {pendingCount} cita{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''}
                  </span>
                </div>

                <p className="text-xs text-gray-600 mb-3">Elige qué hacer con las citas antes de desactivar:</p>

                <div className="space-y-2 mb-4">
                  {/* Option: Smart Reschedule */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      deactivateAction === 'smart_reschedule'
                        ? 'border-primary-400 bg-primary-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="deactivateAction"
                      value="smart_reschedule"
                      checked={deactivateAction === 'smart_reschedule'}
                      onChange={() => setDeactivateAction('smart_reschedule')}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Reagendar inteligente</p>
                      <p className="text-xs text-gray-500">
                        Las citas se mantienen en el mismo horario y se asignan automáticamente a
                        otro empleado capacitado con disponibilidad. Si alguna no puede reasignarse, podrás resolverla manualmente.
                      </p>
                    </div>
                  </label>

                  {/* Option: Reassign */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      deactivateAction === 'reassign'
                        ? 'border-primary-400 bg-primary-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="deactivateAction"
                      value="reassign"
                      checked={deactivateAction === 'reassign'}
                      onChange={() => setDeactivateAction('reassign')}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Reasignar a otro empleado</p>
                      <p className="text-xs text-gray-500">Las citas se transferirán al empleado seleccionado</p>
                      {deactivateAction === 'reassign' && (
                        <select
                          value={targetEmployeeId}
                          onChange={(e) => { setTargetEmployeeId(e.target.value); setDeactivateError(null); }}
                          className="mt-2 w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                        >
                          <option value="">Seleccionar empleado...</option>
                          {activeEmployees.map((emp: any) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.firstName} {emp.lastName}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </label>

                  {/* Option: Cancel */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      deactivateAction === 'cancel'
                        ? 'border-primary-400 bg-primary-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="deactivateAction"
                      value="cancel"
                      checked={deactivateAction === 'cancel'}
                      onChange={() => setDeactivateAction('cancel')}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Cancelar todas las citas</p>
                      <p className="text-xs text-gray-500">Todas las citas pendientes serán canceladas</p>
                      {deactivateAction === 'cancel' && (
                        <textarea
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          placeholder="Motivo de cancelación (opcional)"
                          rows={2}
                          className="mt-2 w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 resize-none"
                        />
                      )}
                    </div>
                  </label>

                  {/* Option: Keep */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      deactivateAction === 'keep'
                        ? 'border-primary-400 bg-primary-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="deactivateAction"
                      value="keep"
                      checked={deactivateAction === 'keep'}
                      onChange={() => setDeactivateAction('keep')}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Mantener citas como están</p>
                      <p className="text-xs text-gray-500">El empleado se desactiva pero sus citas quedan sin cambios</p>
                      {deactivateAction === 'keep' && (
                        <p className="mt-1 text-xs text-amber-600">
                          Las citas seguirán asignadas a un empleado inactivo
                        </p>
                      )}
                    </div>
                  </label>
                </div>

                {/* Error message */}
                {deactivateError && (
                  <div className="mb-3 p-2 rounded-lg bg-red-100 border border-red-300">
                    <p className="text-xs text-red-700">{deactivateError}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const body: any = { action: deactivateAction };
                      if (deactivateAction === 'reassign') body.targetEmployeeId = targetEmployeeId;
                      if (deactivateAction === 'cancel' && cancelReason) body.cancelReason = cancelReason;
                      deactivateMutation.mutate(body);
                    }}
                    disabled={
                      deactivateMutation.isPending ||
                      (deactivateAction === 'reassign' && !targetEmployeeId)
                    }
                    className="btn-danger text-sm py-1.5 px-4"
                  >
                    {deactivateMutation.isPending
                      ? (deactivateAction === 'smart_reschedule' ? 'Reagendando...' : 'Procesando...')
                      : 'Confirmar desactivación'}
                  </button>
                  <button
                    onClick={() => { setShowDeactivateConfirm(false); setDeactivateError(null); }}
                    className="btn-secondary text-sm py-1.5 px-4"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        )}

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
                  label="Ausente"
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
                            {dayjs.utc(apt.startTime).format('MMM')}
                          </p>
                          <p className="text-lg font-bold text-gray-900">
                            {dayjs.utc(apt.startTime).format('DD')}
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
                            {dayjs.utc(apt.startTime).format('h:mm A')}
                          </p>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded-full ${
                              apt.status === 'CONFIRMED'
                                ? 'bg-green-50 text-green-700'
                                : apt.status === 'RESCHEDULED'
                                ? 'bg-orange-50 text-orange-700'
                                : 'bg-yellow-50 text-yellow-700'
                            }`}
                          >
                            {apt.status === 'CONFIRMED' ? 'Confirmada' : apt.status === 'RESCHEDULED' ? 'Reagendada' : 'Pendiente'}
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
            canManage={hasPermission('roles.update')}
          />
        )}
      </div>

      {/* Smart Reschedule Result Modal */}
      {showSmartResult && smartResult && (
        <Modal
          title="Resultado de reagendar inteligente"
          onClose={() => { setShowSmartResult(false); setSmartResult(null); }}
        >
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="flex gap-3">
              <div className="flex-1 p-3 rounded-lg bg-green-50 border border-green-200 text-center">
                <p className="text-2xl font-bold text-green-700">{smartResult.reassignedCount}</p>
                <p className="text-xs text-green-600">Reasignadas</p>
              </div>
              {smartResult.conflicts.length > 0 && (
                <div className="flex-1 p-3 rounded-lg bg-amber-50 border border-amber-200 text-center">
                  <p className="text-2xl font-bold text-amber-700">{smartResult.conflicts.length}</p>
                  <p className="text-xs text-amber-600">Con conflicto</p>
                </div>
              )}
            </div>

            {/* Reassignments list */}
            {smartResult.reassignments.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Citas reasignadas (mismo horario)</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {smartResult.reassignments.map((r) => (
                    <div key={r.appointmentId} className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-xs">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-800">{r.clientName}</p>
                          <p className="text-gray-500">{r.services.join(', ')}</p>
                        </div>
                        <span className="text-green-600 font-medium flex-shrink-0 ml-2">{r.newEmployeeName}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {dayjs.utc(r.startTime).format('D/M/YYYY HH:mm')} - {dayjs.utc(r.endTime).format('HH:mm')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Conflicts preview */}
            {smartResult.conflicts.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-amber-700 mb-2">
                  Citas sin empleado disponible en ese horario
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {smartResult.conflicts.map((c) => (
                    <div key={c.id} className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs">
                      <p className="font-medium text-gray-800">{c.clientName}</p>
                      <p className="text-gray-500">{c.services.map((s) => s.serviceName).join(', ')}</p>
                      <p className="text-amber-600 mt-1">{dayjs.utc(c.startTime).format('D/M/YYYY HH:mm')} - {dayjs.utc(c.endTime).format('HH:mm')}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {smartResult.conflicts.length > 0 ? (
              <button
                onClick={() => {
                  setShowSmartResult(false);
                  setShowConflictWizard(true);
                }}
                className="btn-primary w-full"
              >
                Resolver conflictos manualmente
              </button>
            ) : (
              <button
                onClick={() => { setShowSmartResult(false); setSmartResult(null); }}
                className="btn-primary w-full"
              >
                Entendido
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Conflict Resolution Wizard */}
      {showConflictWizard && conflicts.length > 0 && (
        <Modal
          title={
            resolvedConflicts.length >= conflicts.length
              ? 'Conflictos resueltos'
              : `Resolver conflicto ${currentConflictIdx + 1} de ${conflicts.length}`
          }
          onClose={() => { setShowConflictWizard(false); setConflicts([]); }}
        >
          {resolvedConflicts.length >= conflicts.length ? (
            /* All conflicts resolved — show summary and finalize */
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <p className="text-sm font-medium text-green-800">
                  {reassignedBeforeConflicts} cita{reassignedBeforeConflicts !== 1 ? 's' : ''} reasignada{reassignedBeforeConflicts !== 1 ? 's' : ''} automáticamente
                </p>
                <p className="text-xs text-green-600 mt-1">
                  {resolvedConflicts.filter((r) => r.action === 'reschedule').length} reagendada{resolvedConflicts.filter((r) => r.action === 'reschedule').length !== 1 ? 's' : ''} manualmente,{' '}
                  {resolvedConflicts.filter((r) => r.action === 'cancel').length} cancelada{resolvedConflicts.filter((r) => r.action === 'cancel').length !== 1 ? 's' : ''},{' '}
                  {resolvedConflicts.filter((r) => r.action === 'skip').length} omitida{resolvedConflicts.filter((r) => r.action === 'skip').length !== 1 ? 's' : ''}
                </p>
              </div>

              {deactivateError && (
                <div className="p-2 rounded-lg bg-red-100 border border-red-300">
                  <p className="text-xs text-red-700">{deactivateError}</p>
                </div>
              )}

              <button
                onClick={() => {
                  setDeactivateError(null);
                  finalizeMutation.mutate();
                }}
                disabled={finalizeMutation.isPending}
                className="btn-danger w-full"
              >
                {finalizeMutation.isPending ? 'Finalizando...' : 'Finalizar desactivación'}
              </button>
            </div>
          ) : (
            /* Show current conflict */
            (() => {
              const conflict = conflicts[currentConflictIdx];
              const serviceIds = conflict.services.map((s) => s.serviceId);
              const currentTargetEmpId = wizardMode === 'smart' ? conflictEmployeeId : reassignTargetId;
              return (
                <div className="space-y-4">
                  {/* Conflict info */}
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <p className="text-sm font-medium text-gray-800">{conflict.clientName}</p>
                    <p className="text-xs text-gray-500">
                      {conflict.services.map((s) => s.serviceName).join(', ')}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {dayjs.utc(conflict.startTime).format('D/M/YYYY HH:mm')} - {dayjs.utc(conflict.endTime).format('HH:mm')}
                    </p>
                    {conflict.conflictsWith ? (
                      <div className="mt-2 p-2 rounded bg-amber-50 border border-amber-200">
                        <p className="text-xs text-amber-700">
                          Conflicto: el empleado destino tiene una cita de{' '}
                          {dayjs.utc(conflict.conflictsWith.startTime).format('HH:mm')} a{' '}
                          {dayjs.utc(conflict.conflictsWith.endTime).format('HH:mm')}
                        </p>
                      </div>
                    ) : (
                      <div className="mt-2 p-2 rounded bg-amber-50 border border-amber-200">
                        <p className="text-xs text-amber-700">
                          Ningún empleado disponible en este horario
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Employee selector (smart mode) */}
                  {wizardMode === 'smart' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Seleccionar empleado
                      </label>
                      <select
                        value={conflictEmployeeId}
                        onChange={(e) => {
                          setConflictEmployeeId(e.target.value);
                          setConflictSlots([]);
                          setConflictSelectedSlot(null);
                          // Auto-fetch slots if date is already selected
                          if (conflictDate && e.target.value) {
                            fetchConflictSlots(conflictDate, e.target.value, serviceIds);
                          }
                        }}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="">-- Selecciona un empleado --</option>
                        {activeEmployees.map((emp: any) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.firstName} {emp.lastName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Date picker + slot grid for reschedule */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {wizardMode === 'smart' ? 'Seleccionar fecha y hora' : 'Reagendar a otra fecha/hora'}
                    </label>
                    <input
                      type="date"
                      value={conflictDate}
                      min={dayjs().format('YYYY-MM-DD')}
                      onChange={(e) => {
                        setConflictDate(e.target.value);
                        if (e.target.value && currentTargetEmpId) {
                          fetchConflictSlots(e.target.value, currentTargetEmpId, serviceIds);
                        } else {
                          setConflictSlots([]);
                        }
                      }}
                      disabled={wizardMode === 'smart' && !conflictEmployeeId}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />

                    {loadingConflictSlots && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary-600" />
                        Buscando horarios...
                      </div>
                    )}

                    {conflictDate && !loadingConflictSlots && conflictSlots.length > 0 && (
                      <div className="mt-2 grid grid-cols-4 gap-1 max-h-40 overflow-y-auto">
                        {conflictSlots
                          .filter((s) => s.available)
                          .map((slot) => (
                            <button
                              key={slot.startTime}
                              type="button"
                              onClick={() => setConflictSelectedSlot(slot.startTime)}
                              className={`text-xs py-1.5 px-2 rounded border transition-colors ${
                                conflictSelectedSlot === slot.startTime
                                  ? 'bg-primary-600 text-white border-primary-600'
                                  : 'bg-white text-gray-700 border-gray-200 hover:border-primary-400'
                              }`}
                            >
                              {slot.startTime}
                            </button>
                          ))}
                      </div>
                    )}

                    {conflictDate && !loadingConflictSlots && conflictSlots.filter((s) => s.available).length === 0 && (
                      <p className="mt-2 text-xs text-gray-400">No hay horarios disponibles en esta fecha</p>
                    )}
                  </div>

                  {deactivateError && (
                    <div className="p-2 rounded-lg bg-red-100 border border-red-300">
                      <p className="text-xs text-red-700">{deactivateError}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="space-y-2">
                    <button
                      onClick={() => { setDeactivateError(null); handleResolveConflict('reschedule'); }}
                      disabled={!conflictSelectedSlot || !conflictDate || !currentTargetEmpId || processingConflict}
                      className="btn-primary w-full text-sm py-1.5"
                    >
                      {processingConflict ? 'Reagendando...' : 'Reagendar a este horario'}
                    </button>

                    <div className="flex gap-2">
                      <button
                        onClick={() => { setDeactivateError(null); handleResolveConflict('cancel'); }}
                        disabled={processingConflict}
                        className="flex-1 btn-danger text-sm py-1.5"
                      >
                        Cancelar cita
                      </button>
                      <button
                        onClick={() => { setDeactivateError(null); handleResolveConflict('skip'); }}
                        disabled={processingConflict}
                        className="flex-1 btn-secondary text-sm py-1.5"
                      >
                        Omitir
                      </button>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="flex gap-1">
                    {conflicts.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full ${
                          i < currentConflictIdx || (i === currentConflictIdx && resolvedConflicts.length > currentConflictIdx)
                            ? 'bg-green-400'
                            : i === currentConflictIdx
                            ? 'bg-primary-400'
                            : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              );
            })()
          )}
        </Modal>
      )}

      {/* Cover crop modal — formato vertical (portrait) porque asi se ve
          en el perfil publico del marketplace. La banda chica de la card
          en admin es solo un preview. */}
      {coverPendingFile && (
        <CoverCropModal
          imageFile={coverPendingFile}
          aspect="portrait"
          onAccept={(croppedFile) => {
            coverMutation.mutate(croppedFile);
            setCoverPendingFile(null);
          }}
          onCancel={() => setCoverPendingFile(null)}
          onChooseAnother={() => setCoverPendingFile(null)}
        />
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

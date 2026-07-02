'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { CoverCropModal } from '@/components/ui/cover-crop-modal';
import { StarRating } from '@/components/staff/star-rating';
import { ReviewCard } from '@/components/staff/review-card';
import { PortfolioGallery } from '@/components/staff/portfolio-gallery';
import { EmployeeTraining } from '@/components/staff/employee-training';
import { EmployeeEditDrawer } from '@/components/staff/employee-edit-drawer';
import { AppointmentModal } from '@/components/appointments/appointment-modal';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { formatCurrency, formatDate, getInitials } from '@/lib/utils';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useAuth } from '@/lib/hooks/use-auth';
import dayjs from 'dayjs';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
  posEnabled?: boolean;
  createdAt: string;
  location?: { id: string; name: string };
  employeeServices?: Array<{
    serviceId: string;
    service: {
      id: string;
      name: string;
      durationMinutes?: number;
      price?: number;
      currency?: string;
      description?: string | null;
    };
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

interface ConflictInfo {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  clientName: string;
  services: Array<{ serviceId: string; serviceName: string; durationMinutes: number }>;
  conflictsWith?: { appointmentId: string; startTime: string; endTime: string };
}

interface SmartResult {
  action: 'smart_reschedule';
  reassignedCount: number;
  deactivated: boolean;
  reassignments: SmartReassignment[];
  conflicts: ConflictInfo[];
}

interface SlotInfo {
  startTime: string;
  endTime: string;
  available: boolean;
}

export default function EmployeeProfilePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const { user: authUser } = useAuth();
  const employeeId = params.id as string;

  const canEdit = hasPermission('employees.update');
  const canDelete = hasPermission('employees.delete');
  const canManagePermissions = hasPermission('roles.update');

  // ─── UI state ──────────────────────────────────────────
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  // Deep-link ?edit=1 (desde el botón "Editar" de la tarjeta en /staff): abrimos
  // el drawer de edición directamente y limpiamos el parámetro de la URL para que
  // al recargar o volver no se reabra solo.
  useEffect(() => {
    if (searchParams.get('edit') === '1' && canEdit) {
      setShowEditDrawer(true);
      router.replace(`/staff/${employeeId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, canEdit]);
  const [coverPendingFile, setCoverPendingFile] = useState<File | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  // Menu/lightbox de foto de perfil: icono camara sobre avatar abre menu
  // con 'Ver foto' (lightbox) y 'Cambiar foto' (file picker).
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showAvatarLightbox, setShowAvatarLightbox] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  // Sticky header al hacer scroll (clon del marketplace)
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const nameRef = useRef<HTMLHeadingElement>(null);

  // ─── Deactivation state (mantenido del flujo anterior) ──
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [deactivateAction, setDeactivateAction] = useState<'smart_reschedule' | 'reassign' | 'cancel' | 'keep'>('smart_reschedule');
  const [targetEmployeeId, setTargetEmployeeId] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [loadingPendingCount, setLoadingPendingCount] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  const [showSmartResult, setShowSmartResult] = useState(false);
  const [smartResult, setSmartResult] = useState<SmartResult | null>(null);

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

  // ─── Queries ──────────────────────────────────────────
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
    enabled: !!employeeId,
  });

  // Material/recursos asignados a este empleado (assignedTo = employeeId)
  const { data: assignedResourcesData } = useQuery({
    queryKey: ['employee-resources', employeeId],
    queryFn: () => api.get<{ data: any[] }>(`/api/resources?assignedTo=${employeeId}&perPage=100`),
    enabled: !!employeeId,
  });
  const assignedResources = assignedResourcesData?.data || [];

  // ─── Mutations ─────────────────────────────────────────
  const toggleActiveMutation = useMutation({
    mutationFn: (isActive: boolean) =>
      api.put(`/api/employees/${employeeId}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setShowDeactivateConfirm(false);
    },
  });

  // togglePosMutation: activa/desactiva el acceso del empleado al Punto de Venta.
  const togglePosMutation = useMutation({
    mutationFn: (posEnabled: boolean) =>
      api.put(`/api/employees/${employeeId}`, { posEnabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

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

      setResolvedConflicts((prev) => [...prev, { id: conflict.id, action }]);
      queryClient.invalidateQueries({ queryKey: ['appointments'] });

      if (currentConflictIdx < conflicts.length - 1) {
        setCurrentConflictIdx((prev) => prev + 1);
        setConflictDate('');
        setConflictSlots([]);
        setConflictSelectedSlot(null);
        setConflictCancelReason('');
        setConflictEmployeeId('');
      }
    } catch (err: any) {
      setDeactivateError(err?.message || 'Error al resolver conflicto');
    }
    setProcessingConflict(false);
  };

  const avatarMutation = useMutation({
    mutationFn: (file: File) => api.upload(`/api/employees/${employeeId}/avatar`, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

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
    },
  });

  const coverDeleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/employees/${employeeId}/cover`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  // ─── Scroll listener para sticky header ────────────────
  const handleScroll = useCallback(() => {
    if (!nameRef.current) return;
    const rect = nameRef.current.getBoundingClientRect();
    setShowStickyHeader(rect.bottom < 60);
  }, []);

  useEffect(() => {
    const scrollContainer = document.querySelector('[data-staff-scroll]');
    const target = scrollContainer || window;
    target.addEventListener('scroll', handleScroll, { passive: true });
    return () => target.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const employee = employeeData?.data;
  const isOwnProfile = employee?.userId === authUser?.id;
  const stats = statsData?.data;
  const reviews = reviewsData?.data;

  if (loadingEmployee) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#008080]" />
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-gray-500">No se encontró el empleado solicitado.</p>
          <button
            onClick={() => router.push('/staff')}
            className="px-4 py-2 rounded-lg bg-[#008080] text-white text-sm font-semibold hover:bg-[#006666]"
          >
            Volver a Personal
          </button>
        </div>
      </div>
    );
  }

  const empColor = employee.color || '#008080';
  const fullName = `${employee.firstName} ${employee.lastName}`;
  const hasAvatar = !!employee.avatarUrl;
  const hasCover = !!employee.coverImageUrl;
  const services = (employee.employeeServices || []).map((es) => es.service);
  const specialty = stats?.topServices?.[0]?.serviceName || null;
  const completedCount = stats?.completedAllTime ?? 0;

  function resolveUrl(path?: string | null): string | null {
    if (!path) return null;
    return path.startsWith('http') ? path : `${API_URL}${path}`;
  }

  return (
    <div className="flex flex-col h-full" data-staff-scroll>
      <div className="flex-1 overflow-y-auto bg-gray-50 relative">
        {/* ─── Sticky header (aparece al scrollear) ───
            Render condicional + fixed para no ocupar espacio en el flujo
            cuando no se ve. El left:auto / md:left-64 respeta el sidebar
            admin (w-64 en desktop). */}
        {showStickyHeader && (
          <div
            className="fixed top-0 right-0 left-0 md:left-64 z-40 bg-[#008080] shadow-sm animate-in slide-in-from-top duration-200"
          >
            <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => router.push('/staff')}
                  className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 hover:bg-white/30 transition-colors"
                  aria-label="Volver"
                >
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
                <p className="text-base font-bold text-white truncate">{fullName}</p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setShowEditDrawer(true)}
                  className="px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors"
                >
                  Editar
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─── Hero estilo marketplace cliente: foto grande con overlay
            de gradiente y TODA la identidad (avatar, nombre, bio, stats)
            dentro del hero. La foto cubre la mitad superior y el contenido
            queda anclado abajo. */}
        <div className="relative" style={{ height: '72vh', minHeight: '520px' }}>
          {hasCover ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${resolveUrl(employee.coverImageUrl)})` }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10" />
            </div>
          ) : hasAvatar ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${resolveUrl(employee.avatarUrl)})` }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10" />
            </div>
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(135deg, ${empColor}dd 0%, ${empColor}44 50%, #1a1a2e 100%)` }}
            />
          )}

          {/* Back button (top-left) */}
          {!showStickyHeader && (
            <button
              onClick={() => router.push('/staff')}
              className="absolute left-4 top-4 z-30 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors"
              aria-label="Volver"
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}

          {/* Botones admin (top-right) */}
          {!showStickyHeader && (
            <div className="absolute right-4 top-4 z-30 flex items-center gap-2">
              {canEdit && (
                <button
                  onClick={() => setShowEditDrawer(true)}
                  className="px-3 py-2 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 text-white text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                  </svg>
                  Editar
                </button>
              )}
              {(canEdit || isOwnProfile) && (
                <label className="px-3 py-2 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 text-white text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Z" />
                  </svg>
                  Foto de portada
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setCoverPendingFile(file);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
              )}
              {hasCover && canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('¿Quitar la foto de portada?')) coverDeleteMutation.mutate();
                  }}
                  disabled={coverDeleteMutation.isPending}
                  className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 text-white flex items-center justify-center transition-colors"
                  aria-label="Quitar portada"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Contenido del hero anclado abajo */}
          <div className="relative z-10 flex flex-col justify-end min-h-full px-6 pb-8 max-w-3xl mx-auto">
            {/* Avatar con icono camara abajo a la derecha (solo admin/propio) */}
            <div className="mb-4 flex items-end gap-3">
              <div className="relative flex-shrink-0">
                {hasAvatar ? (
                  <img
                    src={resolveUrl(employee.avatarUrl) || ''}
                    alt=""
                    className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-xl bg-gray-100"
                  />
                ) : (
                  <span
                    className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold border-4 border-white shadow-xl"
                    style={{ backgroundColor: empColor }}
                  >
                    {getInitials(employee.firstName, employee.lastName)}
                  </span>
                )}

                {/* Boton camara como badge abajo-derecha */}
                {(canEdit || isOwnProfile) && (
                  <button
                    type="button"
                    onClick={() => setShowAvatarMenu(true)}
                    className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-white shadow-lg flex items-center justify-center text-[#008080] hover:bg-gray-50 transition-colors border-2 border-white"
                    aria-label="Foto de perfil"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Estado inactivo */}
            {!employee.isActive && (
              <div className="mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/80 backdrop-blur-md text-white text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  Empleado inactivo
                </span>
              </div>
            )}

            {/* JobTitle */}
            {employee.jobTitle && (
              <div className="mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md text-white/90 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#008080]" />
                  {employee.jobTitle}
                </span>
              </div>
            )}

            {/* Nombre */}
            <h1 ref={nameRef} className="text-2xl font-bold text-white mb-1 leading-tight">
              {fullName}
            </h1>

            {/* Contacto */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/80 mb-3">
              {employee.email && <span>{employee.email}</span>}
              {employee.phone && <span>· {employee.phone}</span>}
            </div>

            {/* Bio */}
            {employee.bio && (
              <p
                className="text-xs text-white/80 leading-relaxed max-w-xl mb-3 max-h-28 overflow-y-auto pr-1 whitespace-pre-line"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.3) transparent' }}
              >
                {employee.bio}
              </p>
            )}

            {/* Stats row */}
            <div className="flex flex-wrap gap-2 mb-1">
              {reviews?.averageRating && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md">
                  <svg className="w-4 h-4 text-amber-300" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <div>
                    <p className="text-base font-bold text-white leading-none">{reviews.averageRating}</p>
                    <p className="text-[9px] text-white/60 uppercase tracking-wider">Calificación</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md">
                <svg className="w-4 h-4 text-[#008080]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <div>
                  <p className="text-base font-bold text-white leading-none">{completedCount}</p>
                  <p className="text-[9px] text-white/60 uppercase tracking-wider">Trabajos realizados</p>
                </div>
              </div>

              {specialty && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md">
                  <svg className="w-4 h-4 text-purple-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-white leading-none">{specialty}</p>
                    <p className="text-[9px] text-white/60 uppercase tracking-wider">Especialidad</p>
                  </div>
                </div>
              )}

              {employee.location && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md">
                  <svg className="w-4 h-4 text-blue-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-white leading-none truncate max-w-[140px]">{employee.location.name}</p>
                    <p className="text-[9px] text-white/60 uppercase tracking-wider">Sucursal</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Contenido principal (secciones) ─── */}
        <div className="relative z-10 bg-gray-50 min-h-screen pb-12">
          <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">

            {/* Próximas citas — lo primero despues del header */}
            {stats && stats.upcomingAppointments.length > 0 && (
              <Section title="Próximas citas" count={stats.upcomingAppointments.length}>
                <div className="divide-y divide-gray-100">
                  {stats.upcomingAppointments.map((apt) => {
                    const total = apt.items.reduce((sum, it) => sum + Number(it.priceSnapshot || 0), 0);
                    const services = apt.items.map((it) => it.serviceNameSnapshot).join(', ');
                    return (
                      <button
                        key={apt.id}
                        type="button"
                        onClick={() => setSelectedAppointmentId(apt.id)}
                        className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="text-center flex-shrink-0 w-12">
                          <p className="text-[10px] uppercase tracking-wide text-gray-400">
                            {dayjs.utc(apt.startTime).format('MMM')}
                          </p>
                          <p className="text-lg font-bold text-gray-900">
                            {dayjs.utc(apt.startTime).format('DD')}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {apt.client.firstName} {apt.client.lastName}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {dayjs.utc(apt.startTime).format('h:mm A')}
                            {services && ` · ${services}`}
                          </p>
                        </div>
                        {total > 0 && (
                          <span className="text-sm font-semibold text-[#008080] whitespace-nowrap">
                            {formatCurrency(total)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* Servicios */}
            {services.length > 0 && (
              <Section title={`Servicios de ${employee.firstName}`} count={services.length}>
                <div className="grid gap-3 p-3">
                  {services.map((s) => (
                    <div
                      key={s.id}
                      className="w-full text-left p-3 rounded-xl border border-gray-200 bg-white flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">{s.name}</p>
                        {s.description && (
                          <p className="text-xs text-gray-500 line-clamp-2">{s.description}</p>
                        )}
                      </div>
                      {(s.price != null || s.durationMinutes != null) && (
                        <div className="text-right flex-shrink-0">
                          {s.price != null && (
                            <p className="text-sm font-semibold text-gray-900">
                              {formatCurrency(Number(s.price), s.currency || 'MXN')}
                            </p>
                          )}
                          {s.durationMinutes != null && (
                            <p className="text-xs text-gray-500">{s.durationMinutes} min</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Material asignado (recursos con assignedTo = este empleado) */}
            {assignedResources.length > 0 && (
              <Section title="Material asignado" count={assignedResources.length}>
                <div className="grid gap-3 p-3">
                  {assignedResources.map((r: any) => {
                    const img = r.imageUrl
                      ? (r.imageUrl.startsWith('http') ? r.imageUrl : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${r.imageUrl}`)
                      : null;
                    return (
                      <div key={r.id} className="w-full p-3 rounded-xl border border-gray-200 bg-white flex items-center gap-3">
                        <div className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {img ? (
                            <img src={img} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">{r.name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {[r.type, r.brand, r.serialNumber && `S/N ${r.serialNumber}`].filter(Boolean).join(' · ') || 'Recurso'}
                          </p>
                        </div>
                        {r.value != null && (
                          <p className="text-sm font-semibold text-gray-900 flex-shrink-0">
                            {formatCurrency(Number(r.value), 'MXN')}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* Estadísticas (KPI cards estilo dashboard) */}
            <section>
              <h2 className="text-[11px] md:text-xs font-semibold uppercase tracking-wide mb-2 md:mb-3 text-[var(--text-muted)]">
                Estadísticas
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-3">
                <KpiCard
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  }
                  label="Citas completadas"
                  value={loadingStats ? '—' : (stats?.completedAllTime ?? '-')}
                  subtitle={stats ? `${stats.completedThisMonth} este mes` : undefined}
                />
                <KpiCard
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4" />
                    </svg>
                  }
                  label="Ingresos totales"
                  value={loadingStats ? '—' : (stats ? formatCurrency(stats.totalRevenue) : '-')}
                />
                <KpiCard
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  }
                  label="Cancelaciones"
                  value={loadingStats ? '—' : (stats?.cancelledCount ?? '-')}
                  subtitle={stats ? `${stats.cancellationRate}% tasa` : undefined}
                />
                <KpiCard
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                    </svg>
                  }
                  label="No asistió"
                  value={loadingStats ? '—' : (stats?.noShowCount ?? '-')}
                />
              </div>

              {/* Detalles complementarios */}
              <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-3 md:p-5 space-y-4">
                {stats && stats.topServices.length > 0 && (
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
                      Top servicios
                    </h3>
                    <div className="space-y-2">
                      {stats.topServices.map((svc, i) => {
                        const maxCount = stats.topServices[0].count;
                        const pct = maxCount > 0 ? (svc.count / maxCount) * 100 : 0;
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-xs text-[var(--text-primary)] w-32 truncate flex-shrink-0">
                              {svc.serviceName}
                            </span>
                            <div className="flex-1 bg-[var(--bg-muted)] rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${pct}%`, backgroundColor: empColor }}
                              />
                            </div>
                            <span className="text-xs text-[var(--text-muted)] w-8 text-right flex-shrink-0 tabular-nums">
                              {svc.count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(employee.schedules?.length ?? 0) > 0 && (
                  <div className="pt-3 border-t border-[var(--border)]">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)] mb-2">Horario</p>
                    <ScheduleTable schedules={employee.schedules || []} />
                  </div>
                )}

                <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Miembro desde</p>
                  <p className="text-sm text-[var(--text-primary)]">{formatDate(employee.createdAt, 'D MMM YYYY')}</p>
                </div>
              </div>
            </section>

            {/* Trabajos (Portfolio) */}
            <Section title="Trabajos" count={employee._count?.portfolioImages}>
              <div className="p-3">
                <PortfolioGallery employeeId={employeeId} canEdit={canEdit} />
              </div>
            </Section>

            {/* Comentarios */}
            <Section title="Comentarios" count={reviews?.totalReviews}>
              <div className="p-3 space-y-3">
                {reviews && reviews.averageRating !== null && (
                  <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                    <span className="text-3xl font-bold text-gray-900">{reviews.averageRating}</span>
                    <div>
                      <StarRating rating={reviews.averageRating} size="md" />
                      <p className="text-xs text-gray-500 mt-0.5">
                        {reviews.totalReviews} reseña{reviews.totalReviews !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                )}
                {reviews && reviews.reviews.length > 0 ? (
                  <div className="space-y-3">
                    {reviews.reviews.map((review) => (
                      <ReviewCard key={review.id} review={review} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 py-4 text-center">Sin reseñas aún</p>
                )}
              </div>
            </Section>

            {/* Formación */}
            <Section title="Formación" count={employee._count?.trainings}>
              <div className="p-3">
                <EmployeeTraining employeeId={employeeId} canEdit={canEdit} />
              </div>
            </Section>

            {/* Acceso al Punto de Venta: interruptor por empleado. Cuando está
                activo, el empleado ve el POS en su menú y puede cobrar/vender. */}
            {canEdit && (
              <Section title="Punto de Venta">
                <div className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">Acceso al Punto de Venta</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Permite a este empleado cobrar citas y vender productos en el POS.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!employee.posEnabled}
                    disabled={togglePosMutation.isPending}
                    onClick={() => togglePosMutation.mutate(!employee.posEnabled)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                      employee.posEnabled ? 'bg-[#008080]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                        employee.posEnabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </Section>
            )}

            {/* Botón Desactivar/Reactivar */}
            {canDelete && !isOwnProfile && (
              <div className="pt-2">
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
                        const res = await api.get<{ data: { count: number } }>(
                          `/api/employees/${employeeId}/pending-appointments-count`,
                        );
                        setPendingCount(res.data.count);
                      } catch {
                        setPendingCount(0);
                      }
                      setLoadingPendingCount(false);
                      setShowDeactivateConfirm(true);
                    }}
                    className="w-full px-4 py-3 rounded-xl text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    {loadingPendingCount ? 'Verificando...' : 'Desactivar empleado'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleActiveMutation.mutate(true)}
                    disabled={toggleActiveMutation.isPending}
                    className="w-full px-4 py-3 rounded-xl text-sm font-semibold border border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-50 transition-colors"
                  >
                    {toggleActiveMutation.isPending ? 'Reactivando...' : 'Reactivar empleado'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Modal: confirmar desactivación ─── */}
      {showDeactivateConfirm && (
        <Modal
          title={`Desactivar a ${employee.firstName} ${employee.lastName}?`}
          onClose={() => { setShowDeactivateConfirm(false); setDeactivateError(null); }}
        >
          {pendingCount === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                El empleado no tiene citas pendientes. Dejará de aparecer en el calendario, filtros y al crear citas. Puedes reactivarlo en cualquier momento.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setShowDeactivateConfirm(false); setDeactivateError(null); }}
                  className="px-4 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => deactivateMutation.mutate({ action: 'keep' })}
                  disabled={deactivateMutation.isPending}
                  className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  {deactivateMutation.isPending ? 'Desactivando...' : 'Confirmar desactivación'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-sm font-medium text-amber-800">
                  Este empleado tiene {pendingCount} cita{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''}
                </span>
              </div>

              <p className="text-xs text-gray-600">Elige qué hacer con las citas antes de desactivar:</p>

              <div className="space-y-2">
                <DeactivateOption
                  selected={deactivateAction === 'smart_reschedule'}
                  onSelect={() => setDeactivateAction('smart_reschedule')}
                  title="Reagendar inteligente"
                  desc="Las citas se mantienen en el mismo horario y se asignan automáticamente a otro empleado capacitado con disponibilidad."
                />
                <DeactivateOption
                  selected={deactivateAction === 'reassign'}
                  onSelect={() => setDeactivateAction('reassign')}
                  title="Reasignar a otro empleado"
                  desc="Las citas se transferirán al empleado seleccionado"
                >
                  {deactivateAction === 'reassign' && (
                    <select
                      value={targetEmployeeId}
                      onChange={(e) => { setTargetEmployeeId(e.target.value); setDeactivateError(null); }}
                      className="mt-2 w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                    >
                      <option value="">Seleccionar empleado...</option>
                      {activeEmployees.map((emp: any) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName}
                        </option>
                      ))}
                    </select>
                  )}
                </DeactivateOption>
                <DeactivateOption
                  selected={deactivateAction === 'cancel'}
                  onSelect={() => setDeactivateAction('cancel')}
                  title="Cancelar todas las citas"
                  desc="Todas las citas pendientes serán canceladas"
                >
                  {deactivateAction === 'cancel' && (
                    <textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Motivo de cancelación (opcional)"
                      rows={2}
                      className="mt-2 w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 resize-none"
                    />
                  )}
                </DeactivateOption>
                <DeactivateOption
                  selected={deactivateAction === 'keep'}
                  onSelect={() => setDeactivateAction('keep')}
                  title="Mantener citas como están"
                  desc="El empleado se desactiva pero sus citas quedan sin cambios"
                >
                  {deactivateAction === 'keep' && (
                    <p className="mt-1 text-xs text-amber-600">
                      Las citas seguirán asignadas a un empleado inactivo
                    </p>
                  )}
                </DeactivateOption>
              </div>

              {deactivateError && (
                <div className="p-2 rounded-lg bg-red-100 border border-red-300">
                  <p className="text-xs text-red-700">{deactivateError}</p>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setShowDeactivateConfirm(false); setDeactivateError(null); }}
                  className="px-4 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
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
                  className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  {deactivateMutation.isPending
                    ? (deactivateAction === 'smart_reschedule' ? 'Reagendando...' : 'Procesando...')
                    : 'Confirmar desactivación'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ─── Modal: Smart Reschedule Result ─── */}
      {showSmartResult && smartResult && (
        <Modal
          title="Resultado de reagendar inteligente"
          onClose={() => { setShowSmartResult(false); setSmartResult(null); }}
        >
          <div className="space-y-4">
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
                      <p className="text-amber-600 mt-1">
                        {dayjs.utc(c.startTime).format('D/M/YYYY HH:mm')} - {dayjs.utc(c.endTime).format('HH:mm')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {smartResult.conflicts.length > 0 ? (
              <button
                onClick={() => { setShowSmartResult(false); setShowConflictWizard(true); }}
                className="w-full px-4 py-2 rounded-lg bg-[#008080] text-white text-sm font-semibold hover:bg-[#006666]"
              >
                Resolver conflictos manualmente
              </button>
            ) : (
              <button
                onClick={() => { setShowSmartResult(false); setSmartResult(null); }}
                className="w-full px-4 py-2 rounded-lg bg-[#008080] text-white text-sm font-semibold hover:bg-[#006666]"
              >
                Entendido
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* ─── Modal: Conflict Wizard ─── */}
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
                onClick={() => { setDeactivateError(null); finalizeMutation.mutate(); }}
                disabled={finalizeMutation.isPending}
                className="w-full px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {finalizeMutation.isPending ? 'Finalizando...' : 'Finalizar desactivación'}
              </button>
            </div>
          ) : (
            (() => {
              const conflict = conflicts[currentConflictIdx];
              const serviceIds = conflict.services.map((s) => s.serviceId);
              const currentTargetEmpId = wizardMode === 'smart' ? conflictEmployeeId : reassignTargetId;
              return (
                <div className="space-y-4">
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
                        <p className="text-xs text-amber-700">Ningún empleado disponible en este horario</p>
                      </div>
                    )}
                  </div>

                  {wizardMode === 'smart' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Seleccionar empleado</label>
                      <select
                        value={conflictEmployeeId}
                        onChange={(e) => {
                          setConflictEmployeeId(e.target.value);
                          setConflictSlots([]);
                          setConflictSelectedSlot(null);
                          if (conflictDate && e.target.value) {
                            fetchConflictSlots(conflictDate, e.target.value, serviceIds);
                          }
                        }}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5"
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
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />

                    {loadingConflictSlots && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#008080]" />
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
                                  ? 'bg-[#008080] text-white border-[#008080]'
                                  : 'bg-white text-gray-700 border-gray-200 hover:border-[#008080]/50'
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

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Motivo (si cancelas)</label>
                    <input
                      type="text"
                      value={conflictCancelReason}
                      onChange={(e) => setConflictCancelReason(e.target.value)}
                      placeholder="Opcional"
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                    />
                  </div>

                  {deactivateError && (
                    <div className="p-2 rounded-lg bg-red-100 border border-red-300">
                      <p className="text-xs text-red-700">{deactivateError}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <button
                      onClick={() => { setDeactivateError(null); handleResolveConflict('reschedule'); }}
                      disabled={!conflictSelectedSlot || !conflictDate || !currentTargetEmpId || processingConflict}
                      className="w-full px-4 py-1.5 rounded-lg bg-[#008080] text-white text-sm font-semibold hover:bg-[#006666] disabled:opacity-50"
                    >
                      {processingConflict ? 'Reagendando...' : 'Reagendar a este horario'}
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setDeactivateError(null); handleResolveConflict('cancel'); }}
                        disabled={processingConflict}
                        className="flex-1 px-4 py-1.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                      >
                        Cancelar cita
                      </button>
                      <button
                        onClick={() => { setDeactivateError(null); handleResolveConflict('skip'); }}
                        disabled={processingConflict}
                        className="flex-1 px-4 py-1.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Omitir
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-1">
                    {conflicts.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full ${
                          i < currentConflictIdx ||
                          (i === currentConflictIdx && resolvedConflicts.length > currentConflictIdx)
                            ? 'bg-green-400'
                            : i === currentConflictIdx
                            ? 'bg-[#008080]'
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

      {/* ─── Cover crop modal ─── */}
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

      {/* ─── Menu de foto de perfil (Ver / Cambiar) ─── */}
      {showAvatarMenu && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40"
          onClick={() => setShowAvatarMenu(false)}
        >
          <div
            className="bg-white w-full md:max-w-sm md:rounded-2xl rounded-t-2xl p-4 pb-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4 md:hidden" />
            <h3 className="text-sm font-semibold text-gray-900 text-center mb-3">
              Foto de perfil
            </h3>
            <div className="space-y-2">
              {hasAvatar && (
                <button
                  type="button"
                  onClick={() => { setShowAvatarMenu(false); setShowAvatarLightbox(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--primary-tint)] text-[var(--primary-tint-fg)]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </span>
                  <span className="text-sm font-medium text-gray-900">Ver foto</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => { setShowAvatarMenu(false); avatarFileInputRef.current?.click(); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-left"
              >
                <span className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--primary-tint)] text-[var(--primary-tint-fg)]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                  </svg>
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {hasAvatar ? 'Cambiar foto' : 'Subir foto'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowAvatarMenu(false)}
                className="w-full py-3 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input oculto para subir nueva foto */}
      <input
        ref={avatarFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) avatarMutation.mutate(file);
          e.target.value = '';
        }}
      />

      {/* ─── Lightbox de foto de perfil ─── */}
      {showAvatarLightbox && hasAvatar && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowAvatarLightbox(false)}
        >
          <button
            type="button"
            onClick={() => setShowAvatarLightbox(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={resolveUrl(employee.avatarUrl) || ''}
            alt=""
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* ─── Edit drawer ─── */}
      {/* Modal de cita (al hacer click en una proxima cita) */}
      {selectedAppointmentId && (
        <AppointmentModal
          appointmentId={selectedAppointmentId}
          onClose={() => setSelectedAppointmentId(null)}
          onSave={() => {
            setSelectedAppointmentId(null);
            queryClient.invalidateQueries({ queryKey: ['employee-stats', employeeId] });
          }}
        />
      )}

      {showEditDrawer && (
        <EmployeeEditDrawer
          employeeId={employeeId}
          canEdit={canEdit}
          canManagePermissions={canManagePermissions}
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
          onClose={() => {
            setShowEditDrawer(false);
            queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
          }}
        />
      )}
    </div>
  );
}

// Tabla de horario semanal: una fila por dia (Lun-Dom) con su horario
// o 'Descansa'. Mismo patron que el horario del negocio en marketplace.
const SCHEDULE_DAYS: Array<{ key: string; label: string }> = [
  { key: 'MONDAY', label: 'Lunes' },
  { key: 'TUESDAY', label: 'Martes' },
  { key: 'WEDNESDAY', label: 'Miércoles' },
  { key: 'THURSDAY', label: 'Jueves' },
  { key: 'FRIDAY', label: 'Viernes' },
  { key: 'SATURDAY', label: 'Sábado' },
  { key: 'SUNDAY', label: 'Domingo' },
];

function ScheduleTable({
  schedules,
}: {
  schedules: Array<{ dayOfWeek: string; isWorking: boolean; startTime: string; endTime: string }>;
}) {
  const byDay = new Map(schedules.map((s) => [s.dayOfWeek, s]));
  const todayIdx = (new Date().getDay() + 6) % 7; // Lunes = 0
  return (
    <div className="space-y-1">
      {SCHEDULE_DAYS.map((d, idx) => {
        const sch = byDay.get(d.key);
        const isToday = idx === todayIdx;
        return (
          <div
            key={d.key}
            className={`flex items-center justify-between text-sm py-1 ${
              isToday ? 'font-semibold' : ''
            }`}
          >
            <span className={isToday ? 'text-[#008080]' : 'text-[var(--text-secondary)]'}>
              {d.label}
              {isToday && <span className="ml-1.5 text-[10px] text-[#008080]/70">(hoy)</span>}
            </span>
            {sch?.isWorking ? (
              <span className={isToday ? 'text-[#008080]' : 'text-[var(--text-primary)]'}>
                {sch.startTime} - {sch.endTime}
              </span>
            ) : (
              <span className="text-[var(--text-muted)]">Descansa</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {count != null && <span className="text-xs text-gray-500">{count}</span>}
      </div>
      {children}
    </section>
  );
}

function DeactivateOption({
  selected,
  onSelect,
  title,
  desc,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  desc: string;
  children?: React.ReactNode;
}) {
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
        selected ? 'border-[#008080] bg-[var(--primary-tint)]' : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <input
        type="radio"
        checked={selected}
        onChange={onSelect}
        className="mt-0.5"
      />
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">{desc}</p>
        {children}
      </div>
    </label>
  );
}

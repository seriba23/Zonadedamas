'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';
import { DatePicker } from '@/components/ui/date-picker';
import { usePermissions } from '@/lib/hooks/use-permissions';

interface AttendanceRecord {
  id: string;
  date: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  checkInDistance?: number | null;
  checkOutDistance?: number | null;
  status: 'APPROVED' | 'PENDING_REVIEW' | 'REJECTED';
  notes?: string | null;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  color?: string | null;
  jobTitle?: string | null;
  email?: string;
  phone?: string;
}

type RangeMode = 'week' | 'month' | 'custom';
type StatusFilter = 'all' | 'in_shift' | 'completed' | 'pending' | 'rejected';

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function monthStartIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

export default function EmployeeAttendancePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const employeeId = params.id;
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canReview = hasPermission('employees.update');

  const [rangeMode, setRangeMode] = useState<RangeMode>('week');
  const [customStart, setCustomStart] = useState(daysAgoIso(6));
  const [customEnd, setCustomEnd] = useState(todayIso());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  // Drafts del sheet: el usuario edita aqui y al pulsar Aplicar se
  // confirman a los filtros reales. Permite cancelar sin perder estado.
  const [draftRangeMode, setDraftRangeMode] = useState<RangeMode>(rangeMode);
  const [draftCustomStart, setDraftCustomStart] = useState(customStart);
  const [draftCustomEnd, setDraftCustomEnd] = useState(customEnd);
  const [draftStatus, setDraftStatus] = useState<StatusFilter>(statusFilter);

  const { startDate, endDate } = useMemo(() => {
    if (rangeMode === 'week') return { startDate: daysAgoIso(6), endDate: todayIso() };
    if (rangeMode === 'month') return { startDate: monthStartIso(), endDate: todayIso() };
    return { startDate: customStart, endDate: customEnd };
  }, [rangeMode, customStart, customEnd]);

  const { data: empData } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => api.get<{ data: Employee }>(`/api/employees/${employeeId}`),
    enabled: !!employeeId,
  });

  const { data: attData, isLoading } = useQuery({
    queryKey: ['attendance', employeeId, startDate, endDate],
    queryFn: () =>
      api.get<{ data: AttendanceRecord[] }>(
        `/api/attendance?startDate=${startDate}&endDate=${endDate}&employeeId=${employeeId}`,
      ),
    enabled: !!employeeId,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      api.put(`/api/attendance/${id}/review`, { status }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['attendance', employeeId] }),
  });

  const employee = empData?.data;
  const records = attData?.data || [];

  // Aplica filtros locales: estado + busqueda (en notas o fecha).
  const filtered = records.filter((r) => {
    if (search) {
      const dateStr = new Date(r.date).toLocaleDateString('es', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
      const haystack = `${dateStr} ${r.notes || ''}`.toLowerCase();
      if (!haystack.includes(search.toLowerCase())) return false;
    }
    if (statusFilter === 'in_shift') return !!r.checkInTime && !r.checkOutTime && r.status !== 'REJECTED';
    if (statusFilter === 'completed') return !!r.checkOutTime && r.status === 'APPROVED';
    if (statusFilter === 'pending') return r.status === 'PENDING_REVIEW';
    if (statusFilter === 'rejected') return r.status === 'REJECTED';
    return true;
  });

  // Stats agregados.
  let totalMinutes = 0;
  let presentDays = 0;
  let pendingCount = 0;
  let rejectedCount = 0;
  for (const r of records) {
    if (r.status === 'PENDING_REVIEW') pendingCount++;
    if (r.status === 'REJECTED') rejectedCount++;
    if (r.checkInTime) presentDays++;
    if (r.checkInTime && r.checkOutTime) {
      totalMinutes += Math.round(
        (new Date(r.checkOutTime).getTime() - new Date(r.checkInTime).getTime()) / 60000,
      );
    }
  }
  // Total dias del rango (sin importar registros).
  const rangeDays = Math.max(
    1,
    Math.round(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000,
    ) + 1,
  );
  const absentDays = rangeDays - presentDays;
  const totalHours = Math.floor(totalMinutes / 60);
  const restMinutes = totalMinutes % 60;

  const statusChips: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'in_shift', label: 'En turno' },
    { key: 'completed', label: 'Completados' },
    { key: 'pending', label: 'Pendientes' },
    { key: 'rejected', label: 'Rechazados' },
  ];

  function formatTime(iso?: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  }

  function hoursLabel(r: AttendanceRecord): string | null {
    if (!r.checkInTime || !r.checkOutTime) return null;
    const mins = Math.round((new Date(r.checkOutTime).getTime() - new Date(r.checkInTime).getTime()) / 60000);
    if (mins < 60) return `${mins}min`;
    return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')} h`;
  }

  function statusOf(r: AttendanceRecord): { label: string; color: string; bg: string } {
    if (r.status === 'PENDING_REVIEW') return { label: 'Pendiente', color: 'text-teal-700', bg: 'bg-teal-50' };
    if (r.status === 'REJECTED') return { label: 'Rechazado', color: 'text-red-600', bg: 'bg-red-50' };
    if (r.checkOutTime) return { label: 'Completado', color: 'text-green-700', bg: 'bg-green-50' };
    if (r.checkInTime) return { label: 'En turno', color: 'text-[#008080]', bg: 'bg-teal-50' };
    return { label: '—', color: 'text-gray-500', bg: 'bg-gray-100' };
  }

  const rangeModes: { key: RangeMode; label: string }[] = [
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mes' },
    { key: 'custom', label: 'Personalizado' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4">
        {/* Back + nombre */}
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-[#008080]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>

        {/* Header de empleado */}
        {employee && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <Avatar
              avatarUrl={employee.avatarUrl}
              firstName={employee.firstName}
              lastName={employee.lastName}
              color={employee.color || undefined}
              className="w-12 h-12"
              textClassName="text-base"
            />
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-semibold text-gray-900 truncate">
                {employee.firstName} {employee.lastName}
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {employee.jobTitle || 'Asistencias'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/staff/${employeeId}`)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap"
            >
              Ver perfil
            </button>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <StatCard label="Días presentes" value={String(presentDays)} sub={`de ${rangeDays} días`} />
          <StatCard label="Días ausentes" value={String(absentDays)} />
          <StatCard label="Horas trabajadas" value={`${totalHours}:${String(restMinutes).padStart(2, '0')}`} />
          <StatCard label="Pendientes" value={String(pendingCount)} sub={rejectedCount > 0 ? `${rejectedCount} rechazados` : undefined} />
        </div>

        {/* Buscador + filtro de fecha */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por fecha o nota..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ ['--tw-ring-color' as any]: '#008080' }}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setDraftRangeMode(rangeMode);
              setDraftCustomStart(customStart);
              setDraftCustomEnd(customEnd);
              setDraftStatus(statusFilter);
              setShowFilterSheet(true);
            }}
            aria-label="Filtros"
            className="w-10 h-10 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 flex items-center justify-center flex-shrink-0 relative"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {(rangeMode !== 'week' || statusFilter !== 'all') && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#008080] rounded-full border-2 border-white" />
            )}
          </button>
        </div>

        {/* Indicador del estado filtrado (si no es 'Todos') */}
        {statusFilter !== 'all' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--primary-tint)] text-[var(--primary-tint-fg)] text-[11px] font-medium">
              {statusChips.find((c) => c.key === statusFilter)?.label}
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className="ml-0.5 hover:opacity-70"
                aria-label="Quitar filtro"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          </div>
        )}

        {/* Lista */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-sm text-gray-500">No hay registros en este rango.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => {
              const st = statusOf(r);
              const hours = hoursLabel(r);
              const dateLabel = new Date(r.date).toLocaleDateString('es', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              });
              return (
                <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center gap-3">
                    {/* Día */}
                    <div className="text-center w-12 flex-shrink-0">
                      <p className="text-[10px] uppercase tracking-wide text-gray-400">
                        {dateLabel.split(' ')[0]}
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        {new Date(r.date).getDate()}
                      </p>
                    </div>

                    {/* Horarios */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${st.color} ${st.bg}`}>
                          {st.label}
                        </span>
                        {hours && <span className="text-xs font-mono text-gray-700">{hours}</span>}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-gray-500">
                        <span>
                          <svg className="inline w-3 h-3 mr-0.5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                          </svg>
                          {formatTime(r.checkInTime)}
                        </span>
                        <span>
                          <svg className="inline w-3 h-3 mr-0.5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                          </svg>
                          {formatTime(r.checkOutTime)}
                        </span>
                      </div>
                      {r.checkInDistance != null && r.checkInDistance > 50 && (
                        <p className="text-[10px] text-red-500 mt-0.5">
                          {r.checkInDistance}m de distancia
                        </p>
                      )}
                      {r.notes && (
                        <p className="text-[11px] text-gray-500 mt-0.5 italic truncate">
                          {r.notes}
                        </p>
                      )}
                    </div>

                    {/* Acciones admin */}
                    {canReview && r.status === 'PENDING_REVIEW' && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => reviewMutation.mutate({ id: r.id, status: 'APPROVED' })}
                          className="w-8 h-8 rounded-full bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center"
                          aria-label="Aprobar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => reviewMutation.mutate({ id: r.id, status: 'REJECTED' })}
                          className="w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center"
                          aria-label="Rechazar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sheet de filtros de fecha */}
      {showFilterSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40"
          onClick={() => setShowFilterSheet(false)}
        >
          <div
            className="bg-white w-full md:max-w-sm md:rounded-2xl rounded-t-2xl p-4 pb-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4 md:hidden" />
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Filtros</h3>

            {/* Filtro por estado */}
            <div className="mb-4">
              <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Estado</p>
              <div className="flex flex-wrap gap-2">
                {statusChips.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setDraftStatus(c.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      draftStatus === c.key
                        ? 'bg-[#008080] text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtro por rango */}
            <div className="mb-4">
              <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Rango</p>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden mb-3">
                {rangeModes.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setDraftRangeMode(m.key)}
                    className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                      draftRangeMode === m.key ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {draftRangeMode === 'custom' && (
                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] text-gray-500">Desde</label>
                    <DatePicker value={draftCustomStart} onChange={setDraftCustomStart} />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500">Hasta</label>
                    <DatePicker value={draftCustomEnd} onChange={setDraftCustomEnd} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraftRangeMode('week');
                  setDraftStatus('all');
                  setDraftCustomStart(daysAgoIso(6));
                  setDraftCustomEnd(todayIso());
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => {
                  setRangeMode(draftRangeMode);
                  setCustomStart(draftCustomStart);
                  setCustomEnd(draftCustomEnd);
                  setStatusFilter(draftStatus);
                  setShowFilterSheet(false);
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-[#008080] text-white text-sm font-semibold hover:bg-[#006666]"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

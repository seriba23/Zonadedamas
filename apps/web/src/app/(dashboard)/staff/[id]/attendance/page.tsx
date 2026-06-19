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
  scheduledStartTime?: string | null;
  scheduledEndTime?: string | null;
}

const LATE_GRACE_MIN = 5;

/** Minutos del día (hora local del navegador) de una marca de tiempo. */
function localMinutes(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}
/** Minutos del día de un "HH:mm". */
function hhmmMinutes(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}
/** ¿La entrada fue tarde respecto al horario programado (con tolerancia)? */
function isLateCheckIn(r: AttendanceRecord): boolean {
  const inMin = localMinutes(r.checkInTime);
  const schedMin = hhmmMinutes(r.scheduledStartTime);
  if (inMin == null || schedMin == null) return false;
  return inMin > schedMin + LATE_GRACE_MIN;
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

type RangeMode = 'today' | 'week' | 'month' | 'custom';
type StatusFilter = 'all' | 'in_shift' | 'completed' | 'pending' | 'rejected';

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function weekStartIso(): string {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - day);
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

  const [rangeMode, setRangeMode] = useState<RangeMode>('today');
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
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);

  const { startDate, endDate } = useMemo(() => {
    if (rangeMode === 'today') return { startDate: todayIso(), endDate: todayIso() };
    if (rangeMode === 'week') return { startDate: weekStartIso(), endDate: todayIso() };
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', employeeId] });
      setSelectedRecord(null);
    },
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
    { key: 'today', label: 'Hoy' },
    { key: 'week', label: 'Esta semana' },
    { key: 'month', label: 'Este mes' },
    { key: 'custom', label: 'Personalizado' },
  ];
  // Filtros rápidos visibles (mismo set que el calendario, sin "Personalizado")
  const quickRanges: { key: RangeMode; label: string }[] = [
    { key: 'today', label: 'Hoy' },
    { key: 'week', label: 'Esta semana' },
    { key: 'month', label: 'Este mes' },
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

        {/* Filtros rápidos de fecha (estilo calendario) */}
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          {quickRanges.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setRangeMode(m.key)}
              className={`flex-1 px-3 py-2 text-xs sm:text-sm font-medium transition-colors ${
                rangeMode === m.key ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {m.label}
            </button>
          ))}
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
            {(rangeMode === 'custom' || statusFilter !== 'all') && (
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
              const hours = hoursLabel(r);
              const pending = r.status === 'PENDING_REVIEW';
              const late = isLateCheckIn(r);
              const dateLabel = new Date(r.date).toLocaleDateString('es', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              });
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRecord(r)}
                  className={`w-full text-left bg-white rounded-xl border p-3 transition-colors hover:bg-gray-50 ${
                    pending ? 'border-orange-200' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Día */}
                    <div className="text-center w-11 flex-shrink-0">
                      <p className="text-[10px] uppercase tracking-wide text-gray-400">
                        {dateLabel.split(' ')[0]}
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        {new Date(r.date).getDate()}
                      </p>
                    </div>

                    {/* Entrada · Salida (entrada en rojo si llegó tarde) */}
                    <div className="flex-1 grid grid-cols-2 gap-2 text-center">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-gray-400">Entrada</p>
                        <p className={`text-sm font-mono font-semibold ${late ? 'text-red-600' : 'text-gray-800'}`}>
                          {formatTime(r.checkInTime)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-gray-400">Salida</p>
                        <p className="text-sm font-mono font-semibold text-gray-800">{formatTime(r.checkOutTime)}</p>
                      </div>
                    </div>

                    {/* Total en la esquina derecha (naranja si requiere aprobación) */}
                    <div className={`text-right flex-shrink-0 w-16 border-l pl-2 ${pending ? 'border-orange-100' : 'border-gray-100'}`}>
                      <p className="text-[10px] uppercase tracking-wide text-gray-400">Total</p>
                      <p className={`text-sm font-bold tabular-nums ${pending ? 'text-orange-600' : 'text-gray-900'}`}>{hours || '—'}</p>
                      {(pending || late) && (
                        <span className={`mt-0.5 inline-block text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                          pending ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'
                        }`}>
                          {pending ? 'Por aprobar' : 'Tarde'}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
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

      {/* Detalle del registro + aprobación */}
      {selectedRecord && (() => {
        const r = selectedRecord;
        const late = isLateCheckIn(r);
        const pending = r.status === 'PENDING_REVIEW';
        const st = statusOf(r);
        const outIn = r.checkInDistance != null && r.checkInDistance > 50;
        const outOut = r.checkOutDistance != null && r.checkOutDistance > 50;
        const longDate = new Date(r.date).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
        return (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40" onClick={() => setSelectedRecord(null)}>
            <div className="bg-white w-full md:max-w-sm md:rounded-2xl rounded-t-2xl p-5 pb-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4 md:hidden" />
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900 capitalize">{longDate}</p>
                  <span className={`mt-1 inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${st.color} ${st.bg}`}>{st.label}</span>
                </div>
                <button onClick={() => setSelectedRecord(null)} className="text-gray-400 hover:text-gray-600 p-1 -mr-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Entrada / Salida / Total */}
              <div className="grid grid-cols-3 gap-2 text-center mb-4">
                <div className="bg-gray-50 rounded-xl py-3">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">Entrada</p>
                  <p className={`text-base font-mono font-bold ${late ? 'text-red-600' : 'text-gray-900'}`}>{formatTime(r.checkInTime)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl py-3">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">Salida</p>
                  <p className="text-base font-mono font-bold text-gray-900">{formatTime(r.checkOutTime)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl py-3">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">Total</p>
                  <p className="text-base font-bold text-gray-900 tabular-nums">{hoursLabel(r) || '—'}</p>
                </div>
              </div>

              {/* Avisos */}
              <div className="space-y-2 mb-4">
                {r.scheduledStartTime && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Horario programado</span>
                    <span className="font-medium text-gray-800">{r.scheduledStartTime}{r.scheduledEndTime ? ` – ${r.scheduledEndTime}` : ''}</span>
                  </div>
                )}
                {late && (
                  <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Llegó tarde respecto a su horario.
                  </div>
                )}
                {(outIn || outOut) && (
                  <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Marcó fuera del rango del negocio
                    {outIn ? ` (entrada: ${r.checkInDistance}m)` : ''}{outOut ? ` (salida: ${r.checkOutDistance}m)` : ''}.
                  </div>
                )}
                {r.notes && <p className="text-xs text-gray-500 italic">{r.notes}</p>}
              </div>

              {/* Aprobación admin */}
              {canReview ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => reviewMutation.mutate({ id: r.id, status: 'APPROVED' })}
                    disabled={reviewMutation.isPending || r.status === 'APPROVED'}
                    className="flex-1 py-2.5 rounded-lg bg-[#008080] text-white text-sm font-semibold hover:bg-[#006666] disabled:opacity-50"
                  >
                    {r.status === 'APPROVED' ? 'Aprobado' : 'Aprobar chequeo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => reviewMutation.mutate({ id: r.id, status: 'REJECTED' })}
                    disabled={reviewMutation.isPending || r.status === 'REJECTED'}
                    className="flex-1 py-2.5 rounded-lg border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-50"
                  >
                    {r.status === 'REJECTED' ? 'Rechazado' : 'Rechazar'}
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-gray-400 text-center">No tienes permiso para aprobar registros.</p>
              )}
            </div>
          </div>
        );
      })()}
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

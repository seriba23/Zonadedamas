'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useAuth } from '@/lib/hooks/use-auth';
import { EmployeeScheduleEditor } from '@/components/staff/employee-schedule-editor';
import { DatePicker } from '@/components/ui/date-picker';
import { useCurrency } from '@/lib/hooks/use-currency';
import { Modal } from '@/components/ui/modal';
import { useRegisterTopbarAction } from '@/lib/hooks/use-topbar-action';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  color?: string;
  avatarUrl?: string | null;
  coverImageUrl?: string | null;
  jobTitle?: string | null;
  managerId?: string | null;
  isActive: boolean;
  locationId?: string;
  location?: { id: string; name: string };
  employeeServices?: { service: { name: string } }[];
  averageRating?: number | null;
  totalReviews?: number;
  _count?: { appointments?: number };
}

interface Location {
  id: string;
  name: string;
}

type StaffTab = 'empleados' | 'permisos' | 'asistencias' | 'organigrama' | 'comisiones' | 'horarios';

const TABS: { key: StaffTab; label: string }[] = [
  { key: 'empleados', label: 'Empleados' },
  { key: 'organigrama', label: 'Organigrama' },
  { key: 'asistencias', label: 'Asistencias' },
  { key: 'horarios', label: 'Horarios' },
  { key: 'comisiones', label: 'Comisiones' },
];

export default function StaffPage() {
  const { hasPermission } = usePermissions();
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<StaffTab>('empleados');
  const [search, setSearch] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterService, setFilterService] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Botón "+ Nuevo empleado" en el topbar global (solo cuando la tab Empleados
  // está activa y el usuario tiene permiso).
  useRegisterTopbarAction(
    activeTab === 'empleados' && hasPermission('employees.create') ? (
      <Link
        href="/settings/invite-codes"
        className="px-2.5 md:px-3.5 py-1.5 text-[12px] md:text-sm font-semibold rounded-lg bg-[#008080] text-white hover:bg-[#006666] transition-colors whitespace-nowrap"
      >
        + Nuevo
      </Link>
    ) : null,
    [activeTab, hasPermission],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () =>
      api.get<{ data: Employee[] }>(
        '/api/employees?perPage=100&includeInactive=true',
      ),
  });

  const { data: locationsData } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.get<{ data: Location[] }>('/api/locations'),
  });
  const locations = locationsData?.data || [];

  const registerSelfMutation = useMutation({
    mutationFn: () => api.post('/api/auth/register-as-professional'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      if (refreshUser) refreshUser();
    },
  });

  const changeLocationMutation = useMutation({
    mutationFn: ({ empId, locationId }: { empId: string; locationId: string }) =>
      api.put(`/api/employees/${empId}`, { locationId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });

  const allEmployees = data?.data || [];
  const employees = allEmployees.filter((e) => {
    if (search && !`${e.firstName} ${e.lastName} ${e.email || ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterLocation && e.location?.id !== filterLocation) return false;
    if (filterService && !(e.employeeServices || []).some((es) => es.service.name === filterService)) return false;
    if (filterStatus === 'active' && !e.isActive) return false;
    if (filterStatus === 'inactive' && e.isActive) return false;
    return true;
  });

  // Unique services for filter dropdown
  const allServices = [...new Set(allEmployees.flatMap((e) => (e.employeeServices || []).map((es) => es.service.name)))].sort();

  return (
    <div className="flex flex-col h-full">

      {/* Tabs */}
      <div className="border-b border-[var(--border)] px-3 md:px-6 overflow-x-auto" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <nav className="flex gap-1 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-[#008080] text-[#008080]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-6">

        {/* ─── Tab: Empleados ─── */}
        {activeTab === 'empleados' && (
          <div className="space-y-4 md:space-y-5">
            {/* Header: solo búsqueda + icono de filtros (resto en modal) */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Buscar empleado o rol..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080] bg-[var(--bg-surface)] text-[var(--text-primary)]"
              />
              <button
                type="button"
                onClick={() => setShowFilters(true)}
                aria-label="Filtros"
                className={`flex-shrink-0 p-1.5 md:p-2 rounded-lg border transition-colors ${
                  (filterLocation || filterService || filterStatus)
                    ? 'bg-[#008080] border-[#008080] text-white'
                    : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]'
                }`}
                title="Filtros"
              >
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </button>
            </div>

            {/* KPI row */}
            {!isLoading && employees.length > 0 && (() => {
              const active = employees.filter((e) => e.isActive).length;
              const inactive = employees.length - active;
              const totalApts = employees.reduce((s, e) => s + (e._count?.appointments || 0), 0);
              const withRating = employees.filter((e) => e.averageRating != null);
              const avgRating = withRating.length > 0
                ? (withRating.reduce((s, e) => s + (e.averageRating || 0), 0) / withRating.length).toFixed(1)
                : '—';
              const totalReviews = employees.reduce((s, e) => s + (e.totalReviews || 0), 0);
              return (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                  <div className="rounded-xl border border-[var(--border)] p-4 overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)' }}>
                    <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--text-muted)]">Activos</p>
                    <p className="text-xl md:text-2xl font-extrabold text-[var(--text-primary)] mt-1 tabular-nums">{active}</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{inactive} en pausa</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] p-4 overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)' }}>
                    <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--text-muted)]">Total citas</p>
                    <p className="text-xl md:text-2xl font-extrabold text-[var(--text-primary)] mt-1 tabular-nums">{totalApts}</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">acumulado del equipo</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] p-4 overflow-hidden col-span-2 md:col-span-1" style={{ backgroundColor: 'var(--bg-surface)' }}>
                    <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--text-muted)]">Rating promedio</p>
                    <p className="text-xl md:text-2xl font-extrabold text-[var(--text-primary)] mt-1 tabular-nums">{avgRating}</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{totalReviews} reseña{totalReviews !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              );
            })()}

            {/* Admin alert: si no tiene perfil de empleado */}
            {user && !user.employeeId && hasPermission('employees.create') && (
              <div className="rounded-xl border p-4 flex items-center gap-3" style={{ backgroundColor: 'var(--primary-tint)', borderColor: 'var(--primary-tint-border)' }}>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden"
                  style={{ backgroundColor: '#008080' }}
                >
                  {user.avatarUrl ? (
                    <img src={`${API_URL}${user.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <>{user.firstName[0]}{user.lastName[0]}</>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--primary-tint-fg)' }}>{user.firstName} {user.lastName} (Administrador)</p>
                  <p className="text-xs" style={{ color: 'var(--primary-tint-fg)' }}>Aún no tienes perfil de empleado. Actívalo para aparecer en el equipo.</p>
                </div>
                <button
                  onClick={() => registerSelfMutation.mutate()}
                  disabled={registerSelfMutation.isPending}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#008080] text-white hover:bg-[#006666] transition-colors disabled:opacity-50 whitespace-nowrap flex-shrink-0"
                >
                  {registerSelfMutation.isPending ? 'Activando...' : 'Activar'}
                </button>
              </div>
            )}

            {/* Grid de cards */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="rounded-xl h-64 animate-pulse" style={{ backgroundColor: 'var(--bg-muted)' }} />
                ))}
              </div>
            ) : employees.length === 0 ? (
              <div className="text-center py-16 text-[var(--text-muted)]">No hay empleados</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {employees.map((emp) => {
                  const empColor = emp.color || '#008080';
                  const initials = `${emp.firstName?.[0] ?? ''}${emp.lastName?.[0] ?? ''}`.toUpperCase();
                  const totalApts = emp._count?.appointments || 0;
                  const rating = emp.averageRating != null ? emp.averageRating.toFixed(1) : '—';
                  const services = emp.employeeServices || [];
                  return (
                    <div
                      key={emp.id}
                      className="rounded-xl overflow-hidden border flex flex-col"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                    >
                      {/* Header: foto de portada o gradient con su color */}
                      <div
                        className="h-20 bg-cover bg-center"
                        style={
                          emp.coverImageUrl
                            ? { backgroundImage: `url(${emp.coverImageUrl.startsWith('http') ? emp.coverImageUrl : `${API_URL}${emp.coverImageUrl}`})` }
                            : { background: `linear-gradient(135deg, ${empColor}, ${empColor}99)` }
                        }
                      />
                      {/* Body */}
                      <div className="px-5 pb-4 -mt-8 flex flex-col flex-1">
                        <div className="flex items-end justify-between gap-3">
                          <Link
                            href={`/staff/${emp.id}`}
                            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0 overflow-hidden border-4 hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: empColor, borderColor: 'var(--bg-surface)' }}
                            title={`Ver perfil de ${emp.firstName} ${emp.lastName}`}
                          >
                            {emp.avatarUrl ? (
                              <img src={`${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span>{initials}</span>
                            )}
                          </Link>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${emp.isActive ? 'bg-success-50 text-success-700' : 'bg-[var(--bg-muted)] text-[var(--text-secondary)]'}`}>
                            {emp.isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>

                        <div className="mt-3 min-w-0">
                          <Link href={`/staff/${emp.id}`} className="block">
                            <p className="text-base font-bold text-[var(--text-primary)] truncate hover:text-primary-600 transition-colors">
                              {emp.firstName} {emp.lastName}
                            </p>
                          </Link>
                          <p className="text-xs text-[var(--text-secondary)] truncate">{emp.jobTitle || 'Sin puesto'}</p>
                          {locations.length > 1 && emp.location?.name && (
                            <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">📍 {emp.location.name}</p>
                          )}
                        </div>

                        {/* Servicios chips */}
                        {services.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-3">
                            {services.slice(0, 3).map((es, i) => (
                              <span
                                key={i}
                                className="text-[10px] font-medium px-2 py-0.5 rounded-full border"
                                style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                              >
                                {es.service.name}
                              </span>
                            ))}
                            {services.length > 3 && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-[var(--text-muted)]">
                                +{services.length - 3}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Stats row: Citas y Reseñas son links; Rating es dato plano */}
                        <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-dashed border-[var(--border)]">
                          <Link
                            href={`/calendar?view=day&employeeIds=${emp.id}`}
                            className="rounded-md -m-1 p-1 hover:bg-[var(--bg-muted)] transition-colors"
                            title={`Ver citas de ${emp.firstName}`}
                          >
                            <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--text-muted)]">Citas</p>
                            <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums mt-0.5">{totalApts}</p>
                          </Link>
                          <div className="rounded-md -m-1 p-1">
                            <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--text-muted)]">Rating</p>
                            <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums mt-0.5 flex items-center gap-0.5">
                              {rating}
                              {emp.averageRating != null && (
                                <svg className="w-3 h-3 text-warning-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              )}
                            </p>
                          </div>
                          <Link
                            href={`/staff/${emp.id}?tab=resenas`}
                            className="rounded-md -m-1 p-1 hover:bg-[var(--bg-muted)] transition-colors"
                            title={`Ver reseñas de ${emp.firstName}`}
                          >
                            <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--text-muted)]">Reseñas</p>
                            <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums mt-0.5">{emp.totalReviews || 0}</p>
                          </Link>
                        </div>

                        {/* Botones */}
                        <div className="flex gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => router.push(`/calendar?view=day&employeeIds=${emp.id}`)}
                            className="flex-1 text-center px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] transition-colors"
                          >
                            Ver agenda
                          </button>
                          <button
                            type="button"
                            onClick={() => router.push(`/staff/${emp.id}`)}
                            className="flex-1 text-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#008080] text-white hover:bg-[#006666] transition-colors"
                          >
                            Editar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Modal de filtros */}
            {showFilters && (
              <Modal title="Filtros" onClose={() => setShowFilters(false)} size="md">
                <div className="space-y-5">
                  {locations.length > 1 && (
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                        Sucursal
                      </label>
                      <select
                        value={filterLocation}
                        onChange={(e) => setFilterLocation(e.target.value)}
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                      >
                        <option value="">Todas las sucursales</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {allServices.length > 0 && (
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                        Servicio
                      </label>
                      <select
                        value={filterService}
                        onChange={(e) => setFilterService(e.target.value)}
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                      >
                        <option value="">Todos los servicios</option>
                        {allServices.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                      Estado
                    </label>
                    <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 -mx-1 px-1">
                      {[
                        { key: '', label: 'Todos' },
                        { key: 'active', label: 'Activos' },
                        { key: 'inactive', label: 'Inactivos' },
                      ].map((s) => {
                        const active = filterStatus === s.key;
                        return (
                          <button
                            key={s.key || 'all'}
                            type="button"
                            onClick={() => setFilterStatus(s.key)}
                            className={`flex-shrink-0 inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                              active
                                ? 'bg-[#008080] text-white border-[#008080]'
                                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-muted)]'
                            }`}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 pt-4 border-t border-[var(--border)]">
                    <button
                      onClick={() => {
                        setFilterLocation('');
                        setFilterService('');
                        setFilterStatus('');
                      }}
                      disabled={!filterLocation && !filterService && !filterStatus}
                      className={`flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors whitespace-nowrap ${
                        filterLocation || filterService || filterStatus
                          ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                          : 'bg-[var(--bg-subtle)] border-[var(--border)] text-[var(--text-muted)] cursor-not-allowed'
                      }`}
                    >
                      Limpiar
                    </button>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#008080] text-white hover:bg-[#006666] transition-colors"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </Modal>
            )}
          </div>
        )}

        {/* ─── Tab: Organigrama ─── */}
        {activeTab === 'organigrama' && (
          <OrgChart employees={data?.data || []} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['employees'] })} />
        )}

        {/* ─── Tab: Asistencias ─── */}
        {activeTab === 'asistencias' && (
          <AttendanceTab employees={(data?.data || []).filter((e: any) => e.isActive)} />
        )}

        {/* ─── Tab: Horarios ─── */}
        {activeTab === 'horarios' && (
          <EmployeeSchedulesTab employees={(data?.data || []).filter((e: any) => e.isActive)} />
        )}

        {/* ─── Tab: Comisiones ─── */}
        {activeTab === 'comisiones' && (
          <StaffCommissionsTab />
        )}

      </div>
    </div>
  );
}

/* ─── Placeholder Tab ─── */
function PlaceholderTab({ icon, title, desc, hint }: { icon: string; title: string; desc: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="text-4xl mb-4">{icon}</span>
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">{title}</h2>
      <p className="text-sm text-[var(--text-secondary)] max-w-md mb-3">{desc}</p>
      <p className="text-xs text-[var(--text-muted)] max-w-sm">{hint}</p>
    </div>
  );
}

/* ─── Organigrama Component ─── */
function OrgChart({ employees, onUpdate }: { employees: Employee[]; onUpdate: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const { hasPermission } = usePermissions();

  const expandAll = () => setCollapsedNodes(new Set());
  const collapseAll = () => {
    const withChildren = new Set<string>();
    employees.forEach((emp) => {
      if (emp.managerId) {
        withChildren.add(emp.managerId);
      }
    });
    setCollapsedNodes(withChildren);
  };
  const toggleCollapse = (id: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: ({ empId, managerId }: { empId: string; managerId: string | null }) =>
      api.put(`/api/employees/${empId}`, { managerId: managerId || null }),
    onSuccess: () => {
      setEditingEmpId(null);
      onUpdate();
    },
  });

  if (employees.length === 0) {
    return <div className="text-center py-20 text-[var(--text-muted)]">No hay empleados registrados</div>;
  }

  // Build hierarchy from managerId
  const empMap = new Map(employees.map((e) => [e.id, e]));
  const childrenMap = new Map<string, Employee[]>();
  for (const emp of employees) {
    if (emp.managerId && empMap.has(emp.managerId)) {
      const list = childrenMap.get(emp.managerId) || [];
      list.push(emp);
      childrenMap.set(emp.managerId, list);
    }
  }

  // Root nodes: no managerId, or managerId points to someone not in the list
  const roots = employees.filter((e) => !e.managerId || !empMap.has(e.managerId));
  // The owner/admin is the first root (ideally the one with jobTitle 'Owner' or no jobTitle)
  const topRoot = roots.find((e) => e.jobTitle === 'Owner' || e.jobTitle === 'Dueño') || roots[0];
  // Unassigned: roots that are NOT the topRoot
  const unassigned = roots.filter((e) => e.id !== topRoot?.id);

  function OrgCard({ emp, size = 'normal', isEditing }: { emp: Employee; size?: 'large' | 'normal'; isEditing?: boolean }) {
    const isLarge = size === 'large';
    return (
      <div className={`flex flex-col items-center ${isLarge ? 'mb-2' : ''}`}>
        <div
          className={`rounded-2xl border-2 shadow-lg flex flex-col items-center justify-center overflow-hidden transition-all ${isLarge ? 'w-28 h-32' : 'w-24 h-28'} ${isEditing ? 'border-[#008080] ring-2 ring-teal-300' : 'border-white'}`}
          style={{ backgroundColor: emp.color || '#008080' }}
        >
          <div className={`bg-[var(--bg-surface)]/20 flex items-center justify-center ${isLarge ? 'w-14 h-14 rounded-full mb-1.5' : 'w-10 h-10 rounded-full mb-1'}`}>
            {emp.avatarUrl ? (
              <img src={`${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className={`font-bold text-white ${isLarge ? 'text-lg' : 'text-sm'}`}>{emp.firstName[0]}{emp.lastName[0]}</span>
            )}
          </div>
          <p className="text-[10px] font-semibold text-white text-center px-1 leading-tight">{emp.firstName}</p>
          <p className="text-[9px] text-white/70 text-center px-1 leading-tight">{emp.lastName}</p>
        </div>
        <span className="text-[9px] text-[var(--text-secondary)] mt-1 text-center">{emp.jobTitle || 'Sin puesto'}</span>
      </div>
    );
  }

  function ManagerPicker({ emp }: { emp: Employee }) {
    return (
      <div className="mt-2 bg-[var(--bg-surface)] rounded-lg border border-[var(--border)] shadow-lg p-3 w-52 z-10 relative">
        <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase mb-1.5">Reporta a:</p>
        <select
          value={selectedManagerId || ''}
          onChange={(e) => setSelectedManagerId(e.target.value || null)}
          className="w-full text-xs border border-[var(--border)] rounded-lg px-2 py-1.5 focus:border-[#008080] focus:ring-1 focus:ring-[#008080] mb-2"
        >
          <option value="">Sin jefe (nivel superior)</option>
          {employees
            .filter((e) => e.id !== emp.id)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.firstName} {e.lastName}{e.jobTitle ? ` — ${e.jobTitle}` : ''}
              </option>
            ))}
        </select>
        <div className="flex gap-1.5">
          <button
            onClick={() => saveMutation.mutate({ empId: emp.id, managerId: selectedManagerId })}
            disabled={saveMutation.isPending}
            className="flex-1 text-[10px] font-medium text-white py-1 rounded-md disabled:opacity-50"
            style={{ backgroundColor: '#008080' }}
          >
            {saveMutation.isPending ? '...' : 'Guardar'}
          </button>
          <button
            onClick={() => setEditingEmpId(null)}
            className="flex-1 text-[10px] font-medium text-[var(--text-secondary)] py-1 rounded-md border border-[var(--border)] hover:bg-[var(--bg-muted)]"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  function OrgNode({ emp, isRoot }: { emp: Employee; isRoot?: boolean }) {
    const children = childrenMap.get(emp.id) || [];
    const isEditing = editingEmpId === emp.id;

    return (
      <div className="flex flex-col items-center">
        {/* Card + edit button */}
        <div className="relative group">
          <Link href={`/staff/${emp.id}`}>
            <OrgCard emp={emp} size={isRoot ? 'large' : 'normal'} isEditing={isEditing} />
          </Link>
          {editMode && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setEditingEmpId(isEditing ? null : emp.id);
                setSelectedManagerId(emp.managerId || null);
              }}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--bg-surface)] border border-[var(--border)] shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              title="Cambiar jefe"
            >
              <svg className="w-3 h-3 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
        </div>

        {/* Inline manager picker */}
        {isEditing && editMode && <ManagerPicker emp={emp} />}

        {/* Children */}
        {children.length > 0 && (
          <>
            <div className="w-px h-3 bg-[var(--border)]" />
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleCollapse(emp.id); }}
              className="w-5 h-5 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-muted)] hover:border-[#008080] hover:text-[#008080] transition-colors"
              title={collapsedNodes.has(emp.id) ? 'Expandir' : 'Contraer'}
            >
              <span className="text-[10px] font-bold">{collapsedNodes.has(emp.id) ? `+${children.length}` : '−'}</span>
            </button>
            {!collapsedNodes.has(emp.id) && (
              <>
                <div className="w-px h-3 bg-[var(--border)]" />
                {children.length === 1 ? (
                  <OrgNode emp={children[0]} />
                ) : (
                  <>
                    <div className="relative">
                      <div className="h-px bg-[var(--border)]" style={{ width: Math.max(children.length * 140, 140) }} />
                    </div>
                    <div className="flex gap-6">
                      {children.map((child) => (
                        <div key={child.id} className="flex flex-col items-center">
                          <div className="w-px h-6 bg-[var(--border)]" />
                          <OrgNode emp={child} />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button onClick={expandAll} className="px-3 py-1.5 text-xs font-medium border border-[var(--border)] rounded-lg hover:bg-[var(--bg-muted)]">Expandir</button>
        <button onClick={collapseAll} className="px-3 py-1.5 text-xs font-medium border border-[var(--border)] rounded-lg hover:bg-[var(--bg-muted)]">Contraer</button>
        {hasPermission('employees.update') && (
          <button
            onClick={() => { setEditMode(!editMode); setEditingEmpId(null); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${editMode ? 'bg-[#008080] text-white' : 'border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]'}`}
          >
            {editMode ? 'Listo' : 'Editar estructura'}
          </button>
        )}
        {unassigned.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200">
            <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-xs text-red-700">{unassigned.length} empleado{unassigned.length !== 1 ? 's' : ''} sin jefe asignado</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} className="px-2.5 py-1 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--bg-muted)]">−</button>
          <span className="text-xs text-[var(--text-secondary)] min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(2, z + 0.1))} className="px-2.5 py-1 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--bg-muted)]">+</button>
          <button onClick={() => setZoom(1)} className="px-2.5 py-1 text-xs border border-[var(--border)] rounded-lg hover:bg-[var(--bg-muted)]">Reset</button>
        </div>
      </div>

      {/* Org tree */}
      <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] overflow-auto" style={{ minHeight: 400 }}>
        <div className="flex flex-col items-center py-10 px-8" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', minWidth: 'max-content' }}>
          <OrgNode emp={topRoot} isRoot />

          {/* Unassigned employees */}
          {unassigned.length > 0 && (
            <div className="mt-10 pt-6 border-t-2 border-dashed border-[var(--border)] w-full">
              <p className="text-xs font-semibold text-[var(--text-muted)] text-center mb-4">Sin jefe asignado</p>
              <div className="flex gap-6 justify-center flex-wrap">
                {unassigned.map((emp) => (
                  <div key={emp.id} className="flex flex-col items-center">
                    <div className="relative group">
                      <Link href={`/staff/${emp.id}`}>
                        <OrgCard emp={emp} />
                      </Link>
                      {editMode && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditingEmpId(editingEmpId === emp.id ? null : emp.id);
                            setSelectedManagerId(null);
                          }}
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--bg-surface)] border border-[var(--border)] shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Asignar jefe"
                        >
                          <svg className="w-3 h-3 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {editingEmpId === emp.id && editMode && <ManagerPicker emp={emp} />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Employee Schedules Tab ─── */
function EmployeeSchedulesTab({ employees }: { employees: Employee[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  if (employees.length === 0) {
    return <div className="text-center py-16 text-[var(--text-muted)]">No hay empleados activos.</div>;
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? employees.filter((e) =>
        `${e.firstName} ${e.lastName} ${e.jobTitle || ''}`.toLowerCase().includes(q),
      )
    : employees;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <input
          type="text"
          placeholder="Buscar empleado o puesto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-sm px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080] bg-[var(--bg-surface)] text-[var(--text-primary)]"
        />
        <p className="text-xs text-[var(--text-muted)] hidden md:block">Configura el horario laboral de cada empleado.</p>
      </div>
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-center py-8 text-sm text-[var(--text-muted)]">Sin coincidencias.</p>
        ) : filtered.map((employee) => {
          const isExpanded = expandedId === employee.id;
          return (
            <div key={employee.id} className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : employee.id)}
                className="w-full flex items-center gap-4 p-4 hover:bg-[var(--bg-muted)] transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 overflow-hidden"
                  style={{ backgroundColor: employee.color || '#008080' }}
                >
                  {employee.avatarUrl ? (
                    <img src={`${API_URL}${employee.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <>{employee.firstName[0]}{employee.lastName[0]}</>
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-[var(--text-primary)] text-sm">{employee.firstName} {employee.lastName}</p>
                  <p className="text-xs text-[var(--text-muted)]">{employee.jobTitle || 'Sin puesto'}</p>
                </div>
                <svg
                  className={`w-5 h-5 text-[var(--text-muted)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isExpanded && (
                <div className="border-t border-[var(--border)] p-4">
                  <EmployeeScheduleEditor employeeId={employee.id} />
                </div>
              )}
            </div>
          );
        })
        }
      </div>
    </div>
  );
}

/* ─── Attendance Tab (admin view) ─── */
function AttendanceTab({ employees }: { employees: Employee[] }) {
  const queryClient = useQueryClient();
  type RangeMode = 'day' | 'week' | 'month' | 'custom';
  const [rangeMode, setRangeMode] = useState<RangeMode>('day');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [customStart, setCustomStart] = useState(() => new Date().toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0]);

  // Calculate date range based on mode
  function getDateRange(): { startDate: string; endDate: string } {
    const d = new Date(selectedDate + 'T00:00:00');
    if (rangeMode === 'day') {
      return { startDate: selectedDate, endDate: selectedDate };
    } else if (rangeMode === 'week') {
      const dayOfWeek = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { startDate: monday.toISOString().split('T')[0], endDate: sunday.toISOString().split('T')[0] };
    } else if (rangeMode === 'month') {
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
    } else {
      return { startDate: customStart, endDate: customEnd };
    }
  }

  const { startDate, endDate } = getDateRange();

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', startDate, endDate],
    queryFn: () => api.get<{ data: any[] }>(`/api/attendance?startDate=${startDate}&endDate=${endDate}`),
  });

  const records = data?.data || [];

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      api.put(`/api/attendance/${id}/review`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance'] }),
  });

  // Group records by date for multi-day views
  const byDate = new Map<string, any[]>();
  for (const r of records) {
    const dateKey = new Date(r.date).toISOString().split('T')[0];
    const list = byDate.get(dateKey) || [];
    list.push(r);
    byDate.set(dateKey, list);
  }

  const rangeModes: { key: RangeMode; label: string }[] = [
    { key: 'day', label: 'Día' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mes' },
    { key: 'custom', label: 'Personalizado' },
  ];

  function renderRecordRow(record: any) {
    const emp = record.employee;
    const checkIn = record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : null;
    const checkOut = record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : null;
    const totalMinutes = record.checkInTime && record.checkOutTime
      ? Math.round((new Date(record.checkOutTime).getTime() - new Date(record.checkInTime).getTime()) / 60000)
      : null;
    const hours = totalMinutes != null
      ? totalMinutes < 60
        ? `${totalMinutes}min`
        : `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, '0')}`
      : null;

    let statusInfo: { label: string; color: string; bg: string };
    if (record.status === 'PENDING_REVIEW') {
      statusInfo = { label: 'Pendiente', color: 'text-teal-700', bg: 'bg-teal-50' };
    } else if (record.status === 'REJECTED') {
      statusInfo = { label: 'Rechazado', color: 'text-red-600', bg: 'bg-red-50' };
    } else if (record.checkOutTime) {
      statusInfo = { label: 'Completado', color: 'text-green-600', bg: 'bg-green-50' };
    } else {
      statusInfo = { label: 'En turno', color: 'text-[#008080]', bg: 'bg-teal-50' };
    }

    return (
      <tr key={record.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 overflow-hidden"
              style={{ backgroundColor: emp?.color || '#008080' }}
            >
              {emp?.avatarUrl ? (
                <img src={`${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" />
              ) : (
                <>{emp?.firstName?.[0]}{emp?.lastName?.[0]}</>
              )}
            </div>
            <div>
              <span className="text-[var(--text-primary)] text-sm">{emp?.firstName} {emp?.lastName}</span>
              {record.checkInDistance != null && record.checkInDistance > 50 && (
                <p className="text-[10px] text-red-500">{record.checkInDistance}m de distancia</p>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-center font-mono text-[var(--text-secondary)] text-sm">{checkIn || '—'}</td>
        <td className="px-4 py-3 text-center font-mono text-[var(--text-secondary)] text-sm">{checkOut || '—'}</td>
        <td className="px-4 py-3 text-center text-[var(--text-secondary)] text-sm font-mono">{hours || '—'}</td>
        <td className="px-4 py-3 text-center">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusInfo.color} ${statusInfo.bg}`}>
            {statusInfo.label}
          </span>
        </td>
        <td className="px-4 py-3 text-center">
          {record.status === 'PENDING_REVIEW' && (
            <div className="flex items-center justify-center gap-1">
              <button
                onClick={() => reviewMutation.mutate({ id: record.id, status: 'APPROVED' })}
                className="p-1 rounded hover:bg-green-50 text-green-600"
                title="Aprobar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button
                onClick={() => reviewMutation.mutate({ id: record.id, status: 'REJECTED' })}
                className="p-1 rounded hover:bg-red-50 text-red-500"
                title="Rechazar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  }

  return (
    <div>
      {/* Filters bar */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-3">
          {/* Range mode pills */}
          <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
            {rangeModes.map((mode) => (
              <button
                key={mode.key}
                onClick={() => setRangeMode(mode.key)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  rangeMode === mode.key ? 'bg-[#008080] text-white' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Date picker */}
          {rangeMode !== 'custom' && (
            <div className="w-44">
              <DatePicker value={selectedDate} onChange={(val) => setSelectedDate(val)} />
            </div>
          )}

          {rangeMode === 'custom' && (
            <div className="flex items-center gap-2">
              <div className="w-40"><DatePicker value={customStart} onChange={setCustomStart} /></div>
              <span className="text-xs text-[var(--text-muted)]">a</span>
              <div className="w-40"><DatePicker value={customEnd} onChange={setCustomEnd} /></div>
            </div>
          )}

          {/* Range label */}
          <span className="text-xs text-[var(--text-muted)] ml-auto">
            {startDate === endDate
              ? new Date(startDate + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
              : `${new Date(startDate + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })} — ${new Date(endDate + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}`
            }
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-[var(--bg-muted)] rounded-xl animate-pulse" />)}
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <p>No hay registros de asistencia en este periodo.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rangeMode === 'day' ? (
            <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-subtle)] border-b border-[var(--border)]">
                  <tr className="text-xs text-[var(--text-secondary)] uppercase">
                    <th className="text-left px-4 py-3 font-semibold">Empleado</th>
                    <th className="text-center px-4 py-3 font-semibold">Entrada</th>
                    <th className="text-center px-4 py-3 font-semibold">Salida</th>
                    <th className="text-center px-4 py-3 font-semibold">Horas</th>
                    <th className="text-center px-4 py-3 font-semibold">Estado</th>
                    <th className="text-center px-4 py-3 font-semibold w-20"></th>
                  </tr>
                </thead>
                <tbody>{records.map(renderRecordRow)}</tbody>
              </table>
            </div>
          ) : (
            // Multi-day: group by date
            [...byDate.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([dateKey, dayRecords]) => (
              <div key={dateKey} className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] overflow-hidden">
                <div className="px-4 py-2 bg-[var(--bg-subtle)] border-b border-[var(--border)]">
                  <p className="text-xs font-semibold text-[var(--text-secondary)] capitalize">
                    {new Date(dateKey + 'T12:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-[var(--bg-subtle)]/50 border-b border-[var(--border)]">
                    <tr className="text-[10px] text-[var(--text-muted)] uppercase">
                      <th className="text-left px-4 py-2 font-semibold">Empleado</th>
                      <th className="text-center px-4 py-2 font-semibold">Entrada</th>
                      <th className="text-center px-4 py-2 font-semibold">Salida</th>
                      <th className="text-center px-4 py-2 font-semibold">Horas</th>
                      <th className="text-center px-4 py-2 font-semibold">Estado</th>
                      <th className="text-center px-4 py-2 font-semibold w-20"></th>
                    </tr>
                  </thead>
                  <tbody>{dayRecords.map(renderRecordRow)}</tbody>
                </table>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Staff Commissions Tab (per-employee view) ─── */
function StaffCommissionsTab() {
  const { format: formatCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const [expandedEmps, setExpandedEmps] = useState<Set<string>>(new Set());
  const [configMaps, setConfigMaps] = useState<Map<string, Map<string, { commission: number | null }>>>(new Map());
  const [savingEmpId, setSavingEmpId] = useState<string | null>(null);
  const [savedEmpId, setSavedEmpId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data: employeesData } = useQuery({
    queryKey: ['staff-commissions-employees'],
    queryFn: () => api.get<{ data: any[] }>('/api/employees?perPage=100'),
  });
  const { data: servicesData } = useQuery({
    queryKey: ['staff-commissions-services'],
    queryFn: () => api.get<{ data: any[] }>('/api/services?perPage=100'),
  });

  const employees = (employeesData?.data || []).filter((e: any) => e.isActive);
  const allServices = servicesData?.data || [];
  const allServiceIds = new Set(allServices.map((s: any) => s.id));

  function buildInitialMap(empServices: any[]) {
    const m = new Map<string, { commission: number | null }>();
    for (const es of empServices) {
      const svcId = es.service?.id || es.serviceId;
      if (allServiceIds.has(svcId)) {
        m.set(svcId, { commission: es.commission != null ? Number(es.commission) : null });
      }
    }
    return m;
  }

  function getConfigMap(empId: string, empServices: any[]) {
    return configMaps.get(empId) || buildInitialMap(empServices);
  }

  function toggleService(empId: string, svcId: string, empServices: any[]) {
    setConfigMaps((prev) => {
      const next = new Map(prev);
      const current = next.get(empId) || buildInitialMap(empServices);
      const map = new Map(current);
      if (map.has(svcId)) map.delete(svcId); else map.set(svcId, { commission: null });
      next.set(empId, map);
      return next;
    });
  }

  function updateCommission(empId: string, svcId: string, value: string, empServices: any[]) {
    setConfigMaps((prev) => {
      const next = new Map(prev);
      const current = next.get(empId) || buildInitialMap(empServices);
      const map = new Map(current);
      if (map.get(svcId)) map.set(svcId, { commission: value === '' ? null : parseFloat(value) });
      next.set(empId, map);
      return next;
    });
  }

  function hasChanges(empId: string, empServices: any[]) {
    const map = configMaps.get(empId);
    if (!map) return false;
    const currentIds = new Set(empServices.map((es: any) => es.service?.id || es.serviceId));
    if (map.size !== currentIds.size) return true;
    for (const [svcId, config] of map) {
      if (!currentIds.has(svcId)) return true;
      const es = empServices.find((e: any) => (e.service?.id || e.serviceId) === svcId);
      if (!es) return true;
      const oldComm = es.commission != null ? Number(es.commission) : null;
      if ((config.commission ?? null) !== oldComm) return true;
    }
    return false;
  }

  async function saveChanges(empId: string, empServices: any[]) {
    const map = getConfigMap(empId, empServices);
    setSavingEmpId(empId);
    try {
      await api.put(`/api/employees/${empId}/services`, {
        services: Array.from(map.entries()).map(([serviceId, config]) => ({ serviceId, commission: config.commission })),
      });
      queryClient.invalidateQueries({ queryKey: ['staff-commissions-employees'] });
      setConfigMaps((prev) => { const n = new Map(prev); n.delete(empId); return n; });
      setSavedEmpId(empId);
      setTimeout(() => setSavedEmpId(null), 2000);
    } catch (err) { console.error(err); }
    setSavingEmpId(null);
  }

  if (employees.length === 0) {
    return <div className="text-center py-16 text-[var(--text-muted)]">No hay empleados activos.</div>;
  }

  const q = search.trim().toLowerCase();
  const filteredEmps = q
    ? employees.filter((e: any) =>
        `${e.firstName} ${e.lastName} ${e.jobTitle || ''}`.toLowerCase().includes(q),
      )
    : employees;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <input
          type="text"
          placeholder="Buscar empleado o puesto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-sm px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080] bg-[var(--bg-surface)] text-[var(--text-primary)]"
        />
        <p className="text-xs text-[var(--text-muted)] hidden md:block">Gestiona las comisiones por servicio.</p>
      </div>
      <div className="space-y-4">
        {filteredEmps.length === 0 ? (
          <p className="text-center py-8 text-sm text-[var(--text-muted)]">Sin coincidencias.</p>
        ) : filteredEmps.map((emp: any) => {
          const empServices = (emp.employeeServices || []) as any[];
          const map = getConfigMap(emp.id, empServices);
          const changed = hasChanges(emp.id, empServices);
          const isExpanded = expandedEmps.has(emp.id);

          return (
            <div key={emp.id} className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] overflow-hidden">
              <button
                onClick={() => setExpandedEmps((prev) => { const n = new Set(prev); n.has(emp.id) ? n.delete(emp.id) : n.add(emp.id); return n; })}
                className="w-full px-5 py-3 flex items-center justify-between hover:bg-[var(--bg-muted)] transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: emp.color || '#008080' }}>
                    {emp.avatarUrl ? <img src={`${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" /> : <>{emp.firstName[0]}{emp.lastName[0]}</>}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{emp.firstName} {emp.lastName}</p>
                    <p className="text-xs text-[var(--text-muted)]">{map.size} de {allServices.length} servicios</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {savedEmpId === emp.id && <span className="text-xs text-green-600 font-medium">Guardado</span>}
                  {changed && <span className="w-2 h-2 rounded-full bg-teal-400 flex-shrink-0" />}
                  <svg className={`w-5 h-5 text-[var(--text-muted)] transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {isExpanded && (
                <>
                  <div className="max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-[var(--bg-subtle)] border-b border-[var(--border)]">
                        <tr className="text-xs text-[var(--text-secondary)] uppercase">
                          <th className="w-8 px-2 py-2"></th>
                          <th className="text-left px-2 py-2 font-semibold">Servicio</th>
                          <th className="text-center px-2 py-2 font-semibold w-24">Precio</th>
                          <th className="text-center px-2 py-2 font-semibold w-28">Comisión</th>
                          <th className="text-center px-2 py-2 font-semibold w-24">Ganancia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allServices.map((svc: any) => {
                          const isSelected = map.has(svc.id);
                          const config = map.get(svc.id);
                          const price = Number(svc.price);
                          const comm = config?.commission ?? 0;
                          const profit = price - Number(comm);

                          return (
                            <tr key={svc.id} className={`border-t border-[var(--border)] ${isSelected ? 'bg-teal-50/30' : ''}`}>
                              <td className="px-2 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleService(emp.id, svc.id, empServices)}
                                  className="w-4 h-4 rounded border-[var(--border)] text-[#008080] focus:ring-[#008080]"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <span className={isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}>{svc.name}</span>
                                <span className="text-xs text-[var(--text-muted)] ml-1">({svc.durationMinutes}min)</span>
                              </td>
                              <td className="px-2 py-2 text-center text-[var(--text-secondary)] tabular-nums">{formatCurrency(price, svc.currency)}</td>
                              <td className="px-2 py-2 text-center">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  disabled={!isSelected}
                                  placeholder="0"
                                  value={config?.commission ?? ''}
                                  onChange={(e) => updateCommission(emp.id, svc.id, e.target.value, empServices)}
                                  className="w-24 text-right text-sm border border-[var(--border)] rounded px-2 py-1 tabular-nums disabled:bg-[var(--bg-subtle)] disabled:text-[var(--text-muted)] disabled:cursor-not-allowed focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                                />
                              </td>
                              <td className="px-2 py-2 text-center tabular-nums">
                                {isSelected && config?.commission != null ? (
                                  <span className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(profit, svc.currency)}</span>
                                ) : <span className="text-[var(--text-muted)]">--</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {changed && (
                    <div className="px-5 py-3 bg-teal-50 border-t border-teal-200 flex items-center justify-end">
                      <button
                        onClick={(e) => { e.stopPropagation(); saveChanges(emp.id, empServices); }}
                        disabled={savingEmpId === emp.id}
                        className="text-xs font-medium text-white px-4 py-1.5 rounded-lg disabled:opacity-50"
                        style={{ backgroundColor: '#008080' }}
                      >
                        {savingEmpId === emp.id ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

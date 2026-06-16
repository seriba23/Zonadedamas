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
  // 'organigrama' deshabilitado hasta V2: necesita pulido visual.
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
  // está activa y el usuario tiene permiso). hasPermission cambia de referencia
  // en cada render del hook usePermissions; lo congelamos a un boolean para
  // que el useEffect interno no haga loop.
  const canCreateEmployee = hasPermission('employees.create');
  useRegisterTopbarAction(
    activeTab === 'empleados' && canCreateEmployee ? (
      <Link
        href="/settings/invite-codes"
        className="px-2.5 md:px-3.5 py-1.5 text-[12px] md:text-sm font-semibold rounded-lg bg-[#008080] text-white hover:bg-[#006666] transition-colors whitespace-nowrap"
      >
        + Nuevo
      </Link>
    ) : null,
    [activeTab, canCreateEmployee],
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
                      className="relative rounded-xl overflow-hidden border flex flex-col isolate"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                    >
                      {/* Header: foto de portada o gradient con su color */}
                      <div
                        className="h-20 bg-cover bg-center pointer-events-none"
                        style={
                          emp.coverImageUrl
                            ? { backgroundImage: `url(${emp.coverImageUrl.startsWith('http') ? emp.coverImageUrl : `${API_URL}${emp.coverImageUrl}`})` }
                            : { background: `linear-gradient(135deg, ${empColor}, ${empColor}99)` }
                        }
                      />
                      {/* Body */}
                      <div className="relative z-10 px-5 pb-4 -mt-8 flex flex-col flex-1">
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
                          <a
                            href={`/calendar?view=day&employeeIds=${emp.id}`}
                            className="flex-1 text-center px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] transition-colors"
                          >
                            Ver agenda
                          </a>
                          <a
                            href={`/staff/${emp.id}`}
                            className="flex-1 text-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#008080] text-white hover:bg-[#006666] transition-colors"
                          >
                            Editar
                          </a>
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
  const router = useRouter();
  type StatusFilter = 'all' | 'in_shift' | 'completed' | 'pending';
  type ViewMode = 'personnel' | 'date';

  const [viewMode, setViewMode] = useState<ViewMode>('personnel');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [draftDate, setDraftDate] = useState(selectedDate);
  const [draftStatus, setDraftStatus] = useState<StatusFilter>('all');

  // En vista "por personal" listamos solo el dia seleccionado.
  // En vista "por fecha" listamos los ultimos 7 dias para mostrar la
  // tendencia agrupada por dia. El filtro de fecha sigue funcionando
  // (limita el dia inicial).
  function rangeForView(): { startDate: string; endDate: string } {
    if (viewMode === 'date') {
      const end = selectedDate;
      const startD = new Date(end + 'T00:00:00');
      startD.setDate(startD.getDate() - 6);
      return { startDate: startD.toISOString().split('T')[0], endDate: end };
    }
    return { startDate: selectedDate, endDate: selectedDate };
  }
  const { startDate, endDate } = rangeForView();

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', startDate, endDate],
    queryFn: () => api.get<{ data: any[] }>(`/api/attendance?startDate=${startDate}&endDate=${endDate}`),
  });

  const allRecords = data?.data || [];

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      api.put(`/api/attendance/${id}/review`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance'] }),
  });

  // En vista "por personal" del dia, los empleados sin registro tambien
  // aparecen como ausentes para tener listado completo. En vista "por
  // fecha" agrupamos por dia y solo mostramos quienes ficharon.
  const recordedEmpIds = new Set(allRecords.map((r: any) => r.employee?.id));
  const ausentes = viewMode === 'personnel' && statusFilter === 'all'
    ? employees.filter((e) => !recordedEmpIds.has(e.id)).map((e) => ({
        id: `absent-${e.id}`,
        employee: { id: e.id, firstName: e.firstName, lastName: e.lastName, color: e.color, avatarUrl: e.avatarUrl },
        date: selectedDate,
        checkInTime: null,
        checkOutTime: null,
        status: 'ABSENT',
        checkInDistance: null,
      }))
    : [];

  // Aplica filtros: por estado y por busqueda.
  const filtered = [...allRecords, ...ausentes].filter((r: any) => {
    const emp = r.employee;
    const fullName = `${emp?.firstName || ''} ${emp?.lastName || ''}`.toLowerCase();

    if (search && !fullName.includes(search.toLowerCase())) return false;

    if (statusFilter === 'in_shift') return !!r.checkInTime && !r.checkOutTime && r.status !== 'REJECTED';
    if (statusFilter === 'completed') return !!r.checkOutTime && r.status === 'APPROVED';
    if (statusFilter === 'pending') return r.status === 'PENDING_REVIEW';
    return true;
  });

  // Agrupacion por fecha (solo para vista 'date').
  const byDate = new Map<string, any[]>();
  if (viewMode === 'date') {
    for (const r of filtered) {
      const dateKey = new Date(r.date).toISOString().split('T')[0];
      const list = byDate.get(dateKey) || [];
      list.push(r);
      byDate.set(dateKey, list);
    }
  }
  const dateGroups = [...byDate.entries()].sort(([a], [b]) => b.localeCompare(a));

  const statusChips: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'in_shift', label: 'En turno' },
    { key: 'completed', label: 'Completados' },
    { key: 'pending', label: 'Pendientes' },
  ];

  function statusOf(record: any): { label: string; color: string; bg: string } | null {
    if (record.status === 'ABSENT') return null;
    if (record.status === 'PENDING_REVIEW') return { label: 'Pendiente', color: 'text-teal-700', bg: 'bg-teal-50' };
    if (record.status === 'REJECTED') return { label: 'Rechazado', color: 'text-red-600', bg: 'bg-red-50' };
    if (record.checkOutTime) return { label: 'Completado', color: 'text-green-700', bg: 'bg-green-50' };
    if (record.checkInTime) return { label: 'En turno', color: 'text-[#008080]', bg: 'bg-teal-50' };
    return null;
  }

  function formatTime(iso?: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  }

  function hoursLabel(record: any): string | null {
    if (!record.checkInTime || !record.checkOutTime) return null;
    const mins = Math.round((new Date(record.checkOutTime).getTime() - new Date(record.checkInTime).getTime()) / 60000);
    if (mins < 60) return `${mins}min`;
    return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')} h`;
  }

  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  const dateLabel = isToday
    ? 'Hoy'
    : new Date(selectedDate + 'T12:00:00').toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });

  function renderRecordCard(record: any) {
    const emp = record.employee;
    const st = statusOf(record);
    const hours = hoursLabel(record);
    const isAbsent = record.status === 'ABSENT';
    return (
      <button
        key={record.id}
        type="button"
        disabled={isAbsent && !emp?.id}
        onClick={() => emp?.id && router.push(`/staff/${emp.id}/attendance`)}
        className="w-full bg-white rounded-xl border border-gray-200 hover:border-[#008080] hover:shadow-sm transition-all p-3 text-left disabled:cursor-default disabled:hover:border-gray-200 disabled:hover:shadow-none"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden"
            style={{ backgroundColor: emp?.color || '#008080' }}
          >
            {emp?.avatarUrl ? (
              <img src={`${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" />
            ) : (
              <>{emp?.firstName?.[0]}{emp?.lastName?.[0]}</>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-gray-900 truncate">
                {emp?.firstName} {emp?.lastName}
              </p>
              {st && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${st.color} ${st.bg}`}>
                  {st.label}
                </span>
              )}
            </div>
            {!isAbsent && (
              <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-0.5">
                <span>
                  <svg className="inline w-3 h-3 mr-0.5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                  </svg>
                  {formatTime(record.checkInTime)}
                </span>
                <span>
                  <svg className="inline w-3 h-3 mr-0.5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                  {formatTime(record.checkOutTime)}
                </span>
                {hours && <span className="font-mono text-gray-700">{hours}</span>}
              </div>
            )}
            {record.checkInDistance != null && record.checkInDistance > 50 && (
              <p className="text-[10px] text-red-500 mt-0.5">
                {record.checkInDistance}m de distancia
              </p>
            )}
          </div>

          {record.status === 'PENDING_REVIEW' && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); reviewMutation.mutate({ id: record.id, status: 'APPROVED' }); }}
                className="w-8 h-8 rounded-full bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center"
                aria-label="Aprobar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); reviewMutation.mutate({ id: record.id, status: 'REJECTED' }); }}
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
      </button>
    );
  }

  return (
    <div>
      {/* Barra superior: buscador + boton de filtros */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-0">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar empleado..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:border-transparent"
            style={{ ['--tw-ring-color' as any]: '#008080' }}
          />
        </div>
        <button
          type="button"
          onClick={() => { setDraftDate(selectedDate); setDraftStatus(statusFilter); setShowFilterSheet(true); }}
          aria-label="Filtros"
          className="w-10 h-10 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 flex items-center justify-center flex-shrink-0 relative"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          {(!isToday || statusFilter !== 'all') && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#008080] rounded-full border-2 border-white" />
          )}
        </button>
      </div>

      {/* Toggle de vista: Por personal | Por fecha */}
      <div className="flex rounded-lg border border-gray-300 overflow-hidden mb-3">
        <button
          type="button"
          onClick={() => setViewMode('personnel')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            viewMode === 'personnel'
              ? 'bg-[#008080] text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          Por personal
        </button>
        <button
          type="button"
          onClick={() => setViewMode('date')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            viewMode === 'date'
              ? 'bg-[#008080] text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          Por fecha
        </button>
      </div>

      {/* Etiqueta de fecha + estado activos */}
      <div className="flex items-center justify-between mb-2 text-xs gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-gray-500 capitalize">
            {viewMode === 'date' ? `${startDate.split('-').reverse().join('/')} — ${endDate.split('-').reverse().join('/')}` : dateLabel}
          </span>
          {statusFilter !== 'all' && (
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
          )}
        </div>
        <span className="text-gray-400">
          {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Lista mobile-first */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-[var(--bg-muted)] rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <p className="text-sm">
            {search
              ? `No hay registros para "${search}"`
              : 'No hay registros que coincidan con el filtro.'}
          </p>
        </div>
      ) : viewMode === 'personnel' ? (
        <div className="space-y-2">{filtered.map(renderRecordCard)}</div>
      ) : (
        // Vista por fecha: agrupado por dia (mas reciente arriba)
        <div className="space-y-4">
          {dateGroups.map(([dateKey, dayRecords]) => (
            <div key={dateKey}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
                {new Date(dateKey + 'T12:00:00').toLocaleDateString('es', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
                <span className="ml-2 text-gray-400 normal-case font-normal">
                  ({dayRecords.length} registro{dayRecords.length !== 1 ? 's' : ''})
                </span>
              </p>
              <div className="space-y-2">{dayRecords.map(renderRecordCard)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Sheet de filtros (fecha + estado) */}
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

            {/* Filtro por fecha */}
            <div className="mb-4">
              <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Fecha</p>
              <DatePicker value={draftDate} onChange={(v) => setDraftDate(v)} />
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setDraftDate(new Date().toISOString().split('T')[0])}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 1);
                    setDraftDate(d.toISOString().split('T')[0]);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  Ayer
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraftDate(new Date().toISOString().split('T')[0]);
                  setDraftStatus('all');
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedDate(draftDate);
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

/* ─── Staff Commissions Tab — toggle por empleado / por servicio ─── */
type CommView = 'by-employee' | 'by-service';

function StaffCommissionsTab() {
  const [view, setView] = useState<CommView>('by-employee');
  return (
    <div>
      {/* Toggle segmented */}
      <div className="inline-flex bg-[var(--bg-subtle)] border border-[var(--border)] rounded-lg p-0.5 mb-4">
        <button
          type="button"
          onClick={() => setView('by-employee')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            view === 'by-employee'
              ? 'bg-[#008080] text-white shadow-sm'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]'
          }`}
        >
          Por empleado
        </button>
        <button
          type="button"
          onClick={() => setView('by-service')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            view === 'by-service'
              ? 'bg-[#008080] text-white shadow-sm'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]'
          }`}
        >
          Por servicio
        </button>
      </div>

      {view === 'by-employee' ? <ByEmployeeCommissions /> : <ByServiceCommissions />}
    </div>
  );
}

/* ─── Vista por empleado: lista de empleados; expandir muestra sus servicios ─── */
type CommType = 'AMOUNT' | 'PERCENT';
type CommCfg = { commission: number | null; commissionType: CommType };

function calcProfit(price: number, cfg: CommCfg | undefined): number {
  if (!cfg || cfg.commission == null) return price;
  if (cfg.commissionType === 'PERCENT') {
    return price - (price * cfg.commission) / 100;
  }
  return price - cfg.commission;
}

function ByEmployeeCommissions() {
  const { format: formatCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const [expandedEmps, setExpandedEmps] = useState<Set<string>>(new Set());
  const [configMaps, setConfigMaps] = useState<Map<string, Map<string, CommCfg>>>(new Map());
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
    const m = new Map<string, CommCfg>();
    for (const es of empServices) {
      const svcId = es.service?.id || es.serviceId;
      if (allServiceIds.has(svcId)) {
        m.set(svcId, {
          commission: es.commission != null ? Number(es.commission) : null,
          commissionType: es.commissionType === 'PERCENT' ? 'PERCENT' : 'AMOUNT',
        });
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
      if (map.has(svcId)) map.delete(svcId);
      else map.set(svcId, { commission: null, commissionType: 'AMOUNT' });
      next.set(empId, map);
      return next;
    });
  }

  function updateCommission(empId: string, svcId: string, value: string, empServices: any[]) {
    setConfigMaps((prev) => {
      const next = new Map(prev);
      const current = next.get(empId) || buildInitialMap(empServices);
      const map = new Map(current);
      const cur = map.get(svcId);
      if (cur) map.set(svcId, { ...cur, commission: value === '' ? null : parseFloat(value) });
      next.set(empId, map);
      return next;
    });
  }

  function setCommType(empId: string, svcId: string, type: CommType, empServices: any[]) {
    setConfigMaps((prev) => {
      const next = new Map(prev);
      const current = next.get(empId) || buildInitialMap(empServices);
      const map = new Map(current);
      const cur = map.get(svcId);
      if (cur) map.set(svcId, { ...cur, commissionType: type });
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
      const oldType = es.commissionType === 'PERCENT' ? 'PERCENT' : 'AMOUNT';
      if ((config.commission ?? null) !== oldComm) return true;
      if (config.commissionType !== oldType) return true;
    }
    return false;
  }

  async function saveChanges(empId: string, empServices: any[]) {
    const map = getConfigMap(empId, empServices);
    setSavingEmpId(empId);
    try {
      await api.put(`/api/employees/${empId}/services`, {
        services: Array.from(map.entries()).map(([serviceId, config]) => ({
          serviceId,
          commission: config.commission,
          commissionType: config.commissionType,
        })),
      });
      queryClient.invalidateQueries({ queryKey: ['staff-commissions-employees'] });
      queryClient.invalidateQueries({ queryKey: ['staff-commissions-employees-bs'] });
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
                  <div className="max-h-[60vh] overflow-y-auto bg-[var(--bg-subtle)]/40 p-3 space-y-2">
                    {allServices.map((svc: any) => {
                      const isSelected = map.has(svc.id);
                      const config = map.get(svc.id);
                      const price = Number(svc.price);
                      const profit = calcProfit(price, config);
                      const commType = config?.commissionType ?? 'AMOUNT';

                      return (
                        <div
                          key={svc.id}
                          className={`rounded-xl border p-3 transition-colors ${
                            isSelected
                              ? 'bg-teal-50 border-teal-200'
                              : 'bg-[var(--bg-surface)] border-[var(--border)]'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => toggleService(emp.id, svc.id, empServices)}
                              aria-label={isSelected ? 'Desmarcar' : 'Marcar'}
                              className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'bg-[#008080] border-[#008080]'
                                  : 'bg-white border-gray-300'
                              }`}
                            >
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleService(emp.id, svc.id, empServices)}
                              className="flex-1 min-w-0 text-left"
                            >
                              <p className={`text-sm font-semibold truncate ${isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                                {svc.name}
                              </p>
                              <p className="text-xs text-[var(--text-muted)]">{svc.durationMinutes} min · Precio {formatCurrency(price, svc.currency)}</p>
                            </button>
                          </div>

                          {isSelected && (
                            <div className="mt-3 pl-8 grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">Comisión</label>
                                <div className="flex items-center gap-1.5">
                                  <div className="inline-flex bg-[var(--bg-subtle)] border border-[var(--border)] rounded-lg p-0.5 flex-shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => setCommType(emp.id, svc.id, 'AMOUNT', empServices)}
                                      className={`px-2.5 py-1.5 text-sm font-bold rounded-md transition-colors ${
                                        commType === 'AMOUNT' ? 'bg-[#008080] text-white' : 'text-[var(--text-muted)]'
                                      }`}
                                      title="Monto fijo"
                                    >
                                      $
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setCommType(emp.id, svc.id, 'PERCENT', empServices)}
                                      className={`px-2.5 py-1.5 text-sm font-bold rounded-md transition-colors ${
                                        commType === 'PERCENT' ? 'bg-[#008080] text-white' : 'text-[var(--text-muted)]'
                                      }`}
                                      title="Porcentaje del precio"
                                    >
                                      %
                                    </button>
                                  </div>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max={commType === 'PERCENT' ? 100 : undefined}
                                    placeholder="0"
                                    value={config?.commission ?? ''}
                                    onChange={(e) => updateCommission(emp.id, svc.id, e.target.value, empServices)}
                                    className="w-full text-right text-sm border border-[var(--border)] rounded-lg px-2 py-1.5 tabular-nums focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">Ganancia neta</label>
                                <p className={`text-sm font-semibold tabular-nums py-1.5 ${
                                  config?.commission != null
                                    ? profit >= 0 ? 'text-green-600' : 'text-red-600'
                                    : 'text-[var(--text-muted)]'
                                }`}>
                                  {config?.commission != null ? formatCurrency(profit, svc.currency) : '—'}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
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

/* ─── Vista por servicio: lista de servicios; expandir muestra empleados asignables ─── */
function ByServiceCommissions() {
  const { format: formatCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const [expandedSvcs, setExpandedSvcs] = useState<Set<string>>(new Set());
  const [configMaps, setConfigMaps] = useState<Map<string, Map<string, CommCfg>>>(new Map());
  const [savingSvcId, setSavingSvcId] = useState<string | null>(null);
  const [savedSvcId, setSavedSvcId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data: servicesData } = useQuery({
    queryKey: ['staff-commissions-services-bs'],
    queryFn: () => api.get<{ data: any[] }>('/api/services?perPage=100'),
  });
  const { data: employeesData } = useQuery({
    queryKey: ['staff-commissions-employees-bs'],
    queryFn: () => api.get<{ data: any[] }>('/api/employees?perPage=100'),
  });

  const services = servicesData?.data || [];
  const employees = (employeesData?.data || []).filter((e: any) => e.isActive);
  const allEmpIds = new Set(employees.map((e: any) => e.id));

  // Para un servicio, devuelve el Map de empleados asignados a partir de
  // los datos crudos del fetch (sin meter el state local de edicion).
  function getInitialMap(svcId: string) {
    const m = new Map<string, CommCfg>();
    for (const emp of employees) {
      const es = (emp.employeeServices || []).find(
        (x: any) => (x.service?.id || x.serviceId) === svcId,
      );
      if (es && allEmpIds.has(emp.id)) {
        m.set(emp.id, {
          commission: es.commission != null ? Number(es.commission) : null,
          commissionType: es.commissionType === 'PERCENT' ? 'PERCENT' : 'AMOUNT',
        });
      }
    }
    return m;
  }

  function getMap(svcId: string) {
    return configMaps.get(svcId) || getInitialMap(svcId);
  }

  function toggleEmp(svcId: string, empId: string) {
    setConfigMaps((prev) => {
      const next = new Map(prev);
      const current = next.get(svcId) || getInitialMap(svcId);
      const map = new Map(current);
      if (map.has(empId)) map.delete(empId);
      else map.set(empId, { commission: null, commissionType: 'AMOUNT' });
      next.set(svcId, map);
      return next;
    });
  }

  function updateComm(svcId: string, empId: string, value: string) {
    setConfigMaps((prev) => {
      const next = new Map(prev);
      const current = next.get(svcId) || getInitialMap(svcId);
      const map = new Map(current);
      const cur = map.get(empId);
      if (cur) map.set(empId, { ...cur, commission: value === '' ? null : parseFloat(value) });
      next.set(svcId, map);
      return next;
    });
  }

  function setCommType(svcId: string, empId: string, type: CommType) {
    setConfigMaps((prev) => {
      const next = new Map(prev);
      const current = next.get(svcId) || getInitialMap(svcId);
      const map = new Map(current);
      const cur = map.get(empId);
      if (cur) map.set(empId, { ...cur, commissionType: type });
      next.set(svcId, map);
      return next;
    });
  }

  function hasChanges(svcId: string) {
    const map = configMaps.get(svcId);
    if (!map) return false;
    const original = getInitialMap(svcId);
    if (map.size !== original.size) return true;
    for (const [empId, config] of map) {
      const orig = original.get(empId);
      if (!orig) return true;
      if ((config.commission ?? null) !== (orig.commission ?? null)) return true;
      if (config.commissionType !== orig.commissionType) return true;
    }
    return false;
  }

  async function saveChanges(svcId: string) {
    const map = getMap(svcId);
    setSavingSvcId(svcId);
    try {
      await api.put(`/api/services/${svcId}/employees`, {
        employees: Array.from(map.entries()).map(([employeeId, config]) => ({
          employeeId,
          commission: config.commission,
          commissionType: config.commissionType,
        })),
      });
      queryClient.invalidateQueries({ queryKey: ['staff-commissions-employees-bs'] });
      queryClient.invalidateQueries({ queryKey: ['staff-commissions-employees'] });
      setConfigMaps((prev) => { const n = new Map(prev); n.delete(svcId); return n; });
      setSavedSvcId(svcId);
      setTimeout(() => setSavedSvcId(null), 2000);
    } catch (err) {
      console.error(err);
    }
    setSavingSvcId(null);
  }

  if (services.length === 0) {
    return <div className="text-center py-16 text-[var(--text-muted)]">No hay servicios.</div>;
  }

  const q = search.trim().toLowerCase();
  const filteredSvcs = q
    ? services.filter((s: any) =>
        `${s.name} ${s.category || ''} ${s.subcategory || ''}`.toLowerCase().includes(q),
      )
    : services;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <input
          type="text"
          placeholder="Buscar servicio..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-sm px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080] bg-[var(--bg-surface)] text-[var(--text-primary)]"
        />
        <p className="text-xs text-[var(--text-muted)] hidden md:block">
          Gestiona qué empleados realizan cada servicio y su comisión.
        </p>
      </div>

      <div className="space-y-4">
        {filteredSvcs.length === 0 ? (
          <p className="text-center py-8 text-sm text-[var(--text-muted)]">Sin coincidencias.</p>
        ) : filteredSvcs.map((svc: any) => {
          const map = getMap(svc.id);
          const changed = hasChanges(svc.id);
          const isExpanded = expandedSvcs.has(svc.id);
          const price = Number(svc.price);

          return (
            <div key={svc.id} className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] overflow-hidden">
              <button
                onClick={() => setExpandedSvcs((prev) => { const n = new Set(prev); n.has(svc.id) ? n.delete(svc.id) : n.add(svc.id); return n; })}
                className="w-full px-5 py-3 flex items-center justify-between hover:bg-[var(--bg-muted)] transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center bg-teal-50 text-[#008080]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--text-primary)] truncate">{svc.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {map.size} de {employees.length} empleado{employees.length === 1 ? '' : 's'} · {formatCurrency(price, svc.currency)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {savedSvcId === svc.id && <span className="text-xs text-green-600 font-medium">Guardado</span>}
                  {changed && <span className="w-2 h-2 rounded-full bg-teal-400 flex-shrink-0" />}
                  <svg className={`w-5 h-5 text-[var(--text-muted)] transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {isExpanded && (
                <>
                  <div className="max-h-[60vh] overflow-y-auto bg-[var(--bg-subtle)]/40 p-3 space-y-2">
                    {employees.length === 0 ? (
                      <p className="text-center py-4 text-sm text-[var(--text-muted)]">No hay empleados activos.</p>
                    ) : employees.map((emp: any) => {
                      const isSelected = map.has(emp.id);
                      const config = map.get(emp.id);
                      const profit = calcProfit(price, config);
                      const commType = config?.commissionType ?? 'AMOUNT';

                      return (
                        <div
                          key={emp.id}
                          className={`rounded-xl border p-3 transition-colors ${
                            isSelected
                              ? 'bg-teal-50 border-teal-200'
                              : 'bg-[var(--bg-surface)] border-[var(--border)]'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => toggleEmp(svc.id, emp.id)}
                              aria-label={isSelected ? 'Desmarcar' : 'Marcar'}
                              className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'bg-[#008080] border-[#008080]'
                                  : 'bg-white border-gray-300'
                              }`}
                            >
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleEmp(svc.id, emp.id)}
                              className="flex-1 min-w-0 text-left flex items-center gap-3"
                            >
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: emp.color || '#008080' }}>
                                {emp.avatarUrl ? <img src={`${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" /> : <>{emp.firstName[0]}{emp.lastName[0]}</>}
                              </div>
                              <div className="min-w-0">
                                <p className={`text-sm font-semibold truncate ${isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                                  {emp.firstName} {emp.lastName}
                                </p>
                                {emp.jobTitle && (
                                  <p className="text-xs text-[var(--text-muted)] truncate">{emp.jobTitle}</p>
                                )}
                              </div>
                            </button>
                          </div>

                          {isSelected && (
                            <div className="mt-3 pl-8 grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">Comisión</label>
                                <div className="flex items-center gap-1.5">
                                  <div className="inline-flex bg-[var(--bg-subtle)] border border-[var(--border)] rounded-lg p-0.5 flex-shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => setCommType(svc.id, emp.id, 'AMOUNT')}
                                      className={`px-2.5 py-1.5 text-sm font-bold rounded-md transition-colors ${
                                        commType === 'AMOUNT' ? 'bg-[#008080] text-white' : 'text-[var(--text-muted)]'
                                      }`}
                                      title="Monto fijo"
                                    >
                                      $
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setCommType(svc.id, emp.id, 'PERCENT')}
                                      className={`px-2.5 py-1.5 text-sm font-bold rounded-md transition-colors ${
                                        commType === 'PERCENT' ? 'bg-[#008080] text-white' : 'text-[var(--text-muted)]'
                                      }`}
                                      title="Porcentaje del precio"
                                    >
                                      %
                                    </button>
                                  </div>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max={commType === 'PERCENT' ? 100 : undefined}
                                    placeholder="0"
                                    value={config?.commission ?? ''}
                                    onChange={(e) => updateComm(svc.id, emp.id, e.target.value)}
                                    className="w-full text-right text-sm border border-[var(--border)] rounded-lg px-2 py-1.5 tabular-nums focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">Ganancia neta</label>
                                <p className={`text-sm font-semibold tabular-nums py-1.5 ${
                                  config?.commission != null
                                    ? profit >= 0 ? 'text-green-600' : 'text-red-600'
                                    : 'text-[var(--text-muted)]'
                                }`}>
                                  {config?.commission != null ? formatCurrency(profit, svc.currency) : '—'}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {changed && (
                    <div className="px-5 py-3 bg-teal-50 border-t border-teal-200 flex items-center justify-end">
                      <button
                        onClick={(e) => { e.stopPropagation(); saveChanges(svc.id); }}
                        disabled={savingSvcId === svc.id}
                        className="text-xs font-medium text-white px-4 py-1.5 rounded-lg disabled:opacity-50"
                        style={{ backgroundColor: '#008080' }}
                      >
                        {savingSvcId === svc.id ? 'Guardando...' : 'Guardar cambios'}
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

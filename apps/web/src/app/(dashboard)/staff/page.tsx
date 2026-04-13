'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useAuth } from '@/lib/hooks/use-auth';
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
  jobTitle?: string | null;
  isActive: boolean;
  locationId?: string;
  location?: { id: string; name: string };
  employeeServices?: { service: { name: string } }[];
}

interface Location {
  id: string;
  name: string;
}

type StaffTab = 'empleados' | 'permisos' | 'asistencias' | 'organigrama' | 'comisiones' | 'documentos' | 'formacion' | 'evaluaciones' | 'nomina' | 'horarios';

const TABS: { key: StaffTab; label: string }[] = [
  { key: 'empleados', label: 'Empleados' },
  { key: 'organigrama', label: 'Organigrama' },
  { key: 'asistencias', label: 'Asistencias' },
  { key: 'horarios', label: 'Horarios' },
  { key: 'comisiones', label: 'Comisiones' },
  { key: 'evaluaciones', label: 'Evaluaciones' },
  { key: 'formacion', label: 'Formación' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'nomina', label: 'Nómina' },
];

export default function StaffPage() {
  const { hasPermission } = usePermissions();
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<StaffTab>('empleados');
  const [search, setSearch] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterService, setFilterService] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

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
      <Header title="Personal" />

      {/* Tabs */}
      <div className="border-b border-gray-200 px-6 overflow-x-auto">
        <nav className="flex gap-1 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-[#008080] text-[#008080]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto p-6">

        {/* ─── Tab: Empleados ─── */}
        {activeTab === 'empleados' && (
          <div>
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap flex-1">
                <input
                  type="text"
                  placeholder="Buscar empleado..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080] w-48"
                />
                {locations.length > 1 && (
                  <select
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080] bg-white"
                  >
                    <option value="">Todas las sucursales</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                )}
                {allServices.length > 0 && (
                  <select
                    value={filterService}
                    onChange={(e) => setFilterService(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080] bg-white"
                  >
                    <option value="">Todos los servicios</option>
                    {allServices.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                )}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080] bg-white"
                >
                  <option value="">Todos los estados</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                </select>
              </div>
              {hasPermission('employees.create') && (
                <Link href="/settings/invite-codes" className="btn-primary text-sm">
                  + Nuevo Empleado
                </Link>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}</div>
            ) : employees.length === 0 ? (
              <div className="text-center py-16 text-gray-400">No hay empleados</div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Empleado</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Puesto</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Sucursal</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Contacto</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Servicios</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Admin row — shown if admin has no employee profile */}
                    {user && !user.employeeId && hasPermission('employees.create') && (
                      <tr className="border-b border-gray-100 bg-amber-50/40">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden"
                              style={{ backgroundColor: '#008080' }}
                            >
                              {user.avatarUrl ? (
                                <img src={`${API_URL}${user.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <>{user.firstName[0]}{user.lastName[0]}</>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{user.firstName} {user.lastName}</p>
                              <p className="text-[10px] text-gray-400">Administrador</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); registerSelfMutation.mutate(); }}
                            disabled={registerSelfMutation.isPending}
                            className="px-3 py-1 text-xs font-medium rounded-full bg-[#008080] text-white hover:bg-[#006666] transition-colors disabled:opacity-50"
                          >
                            {registerSelfMutation.isPending ? 'Activando...' : 'Activar'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">—</td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-gray-600">{user.email}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">—</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Sin activar</span>
                        </td>
                      </tr>
                    )}
                    {employees.map((emp) => (
                      <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => window.location.href = `/staff/${emp.id}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden"
                              style={{ backgroundColor: emp.color || '#008080' }}
                            >
                              {emp.avatarUrl ? (
                                <img src={`${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <>{emp.firstName[0]}{emp.lastName[0]}</>
                              )}
                            </div>
                            <p className="text-sm font-medium text-gray-900">{emp.firstName} {emp.lastName}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{emp.jobTitle || '—'}</td>
                        <td className="px-4 py-3">
                          {locations.length > 1 ? (
                            <select
                              value={emp.location?.id || ''}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => changeLocationMutation.mutate({ empId: emp.id, locationId: e.target.value })}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080] cursor-pointer"
                            >
                              {locations.map((loc) => (
                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-gray-600">{emp.location?.name || '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-gray-600">{emp.email || '—'}</p>
                          {emp.phone && <p className="text-xs text-gray-400">{emp.phone}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {(emp.employeeServices || []).slice(0, 3).map((es, i) => (
                              <span key={i} className="text-[10px] bg-teal-50 text-[#008080] border border-teal-100 rounded-full px-2 py-0.5">{es.service.name}</span>
                            ))}
                            {(emp.employeeServices || []).length > 3 && (
                              <span className="text-[10px] text-gray-400">+{(emp.employeeServices || []).length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${emp.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {emp.isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── Tab: Organigrama ─── */}
        {activeTab === 'organigrama' && (
          <OrgChart employees={data?.data || []} />
        )}

        {/* ─── Tab: Asistencias ─── */}
        {activeTab === 'asistencias' && (
          <PlaceholderTab
            icon="📋"
            title="Registro de asistencias"
            desc="Gestiona vacaciones, permisos, ausencias y días festivos de tu equipo."
            hint="Selecciona un empleado de la lista para gestionar sus ausencias individualmente desde su perfil."
          />
        )}

        {/* ─── Tab: Horarios ─── */}
        {activeTab === 'horarios' && (
          <PlaceholderTab
            icon="🕐"
            title="Horarios del equipo"
            desc="Vista general de los horarios de todos los empleados en una sola pantalla."
            hint="Próximamente: grid semanal con los horarios de todo el equipo."
          />
        )}

        {/* ─── Tab: Comisiones ─── */}
        {activeTab === 'comisiones' && (
          <PlaceholderTab
            icon="💰"
            title="Comisiones"
            desc="Cálculo y seguimiento de comisiones por empleado y servicio."
            hint="Próximamente: configuración de porcentajes por servicio y reportes de pago."
          />
        )}

        {/* ─── Tab: Evaluaciones ─── */}
        {activeTab === 'evaluaciones' && (
          <PlaceholderTab
            icon="⭐"
            title="Evaluaciones de desempeño"
            desc="Evaluaciones periódicas del rendimiento de tu equipo."
            hint="Próximamente: calificaciones, objetivos y retroalimentación."
          />
        )}

        {/* ─── Tab: Formacion ─── */}
        {activeTab === 'formacion' && (
          <PlaceholderTab
            icon="🎓"
            title="Formación y capacitación"
            desc="Cursos, certificaciones y desarrollo profesional del equipo."
            hint="Próximamente: registro de cursos completados y pendientes."
          />
        )}

        {/* ─── Tab: Documentos ─── */}
        {activeTab === 'documentos' && (
          <PlaceholderTab
            icon="📄"
            title="Documentos"
            desc="Contratos, identificaciones, certificados y archivos de cada empleado."
            hint="Próximamente: repositorio centralizado de documentos del equipo."
          />
        )}

        {/* ─── Tab: Nomina ─── */}
        {activeTab === 'nomina' && (
          <PlaceholderTab
            icon="💵"
            title="Nómina"
            desc="Registro de pagos, adelantos y bonificaciones del equipo."
            hint="Próximamente: historial de pagos y exportación para contabilidad."
          />
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
      <h2 className="text-lg font-semibold text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-gray-500 max-w-md mb-3">{desc}</p>
      <p className="text-xs text-gray-400 max-w-sm">{hint}</p>
    </div>
  );
}

/* ─── Organigrama Component ─── */
function OrgChart({ employees }: { employees: Employee[] }) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);

  if (employees.length === 0) {
    return <div className="text-center py-20 text-gray-400">No hay empleados registrados</div>;
  }

  // Find owner (first employee, or one without jobTitle meaning they're the boss)
  const owner = employees.find((e) => !e.jobTitle || e.jobTitle === 'Owner') || employees[0];

  // Build hierarchy: group by jobTitle
  const byJobTitle: Record<string, Employee[]> = {};
  employees.forEach((emp) => {
    if (emp.id === owner.id) return;
    const title = emp.jobTitle || 'Sin puesto';
    if (!byJobTitle[title]) byJobTitle[title] = [];
    byJobTitle[title].push(emp);
  });

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<string>();
    all.add(owner.id);
    Object.keys(byJobTitle).forEach((t) => all.add(t));
    setExpandedNodes(all);
  };

  const collapseAll = () => setExpandedNodes(new Set());

  function OrgCard({ emp, size = 'normal' }: { emp: Employee; size?: 'large' | 'normal' }) {
    const isLarge = size === 'large';
    return (
      <div className={`flex flex-col items-center ${isLarge ? 'mb-2' : ''}`}>
        <div
          className={`rounded-2xl border-2 border-white shadow-lg flex flex-col items-center justify-center overflow-hidden ${isLarge ? 'w-28 h-32' : 'w-24 h-28'}`}
          style={{ backgroundColor: emp.color || '#008080' }}
        >
          <div className={`bg-white/20 flex items-center justify-center ${isLarge ? 'w-14 h-14 rounded-full mb-1.5' : 'w-10 h-10 rounded-full mb-1'}`}>
            {emp.avatarUrl ? (
              <img src={`${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className={`font-bold text-white ${isLarge ? 'text-lg' : 'text-sm'}`}>{emp.firstName[0]}{emp.lastName[0]}</span>
            )}
          </div>
          <p className="text-[10px] font-semibold text-white text-center px-1 leading-tight">{emp.firstName}</p>
          <p className="text-[9px] text-white/70 text-center px-1 leading-tight">{emp.lastName}</p>
        </div>
        {emp.jobTitle && (
          <span className="text-[9px] text-gray-500 mt-1 text-center">{emp.jobTitle}</span>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button onClick={expandAll} className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50">Expandir</button>
        <button onClick={collapseAll} className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50">Contraer</button>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} className="px-2.5 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">−</button>
          <span className="text-xs text-gray-500 min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(2, z + 0.1))} className="px-2.5 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">+</button>
          <button onClick={() => setZoom(1)} className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">Reset</button>
        </div>
      </div>

      {/* Org tree */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-auto" style={{ minHeight: 400 }}>
        <div className="flex flex-col items-center py-10 px-8" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', minWidth: 'max-content' }}>
          {/* Owner / Root */}
          <OrgCard emp={owner} size="large" />

          {/* Connector line */}
          {Object.keys(byJobTitle).length > 0 && (
            <>
              <div className="w-px h-6 bg-gray-300" />
              <div className="relative">
                <div className="h-px bg-gray-300" style={{ width: Math.max(Object.keys(byJobTitle).length * 160, 160) }} />
              </div>

              {/* Groups by job title */}
              <div className="flex gap-8 mt-0">
                {Object.entries(byJobTitle).map(([title, emps]) => {
                  const isExpanded = expandedNodes.has(title);
                  return (
                    <div key={title} className="flex flex-col items-center">
                      <div className="w-px h-6 bg-gray-300" />
                      <button
                        onClick={() => toggleNode(title)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-colors mb-2"
                        style={{ borderColor: '#008080', color: isExpanded ? 'white' : '#008080', backgroundColor: isExpanded ? '#008080' : 'white' }}
                      >
                        {title} ({emps.length})
                      </button>

                      {isExpanded && (
                        <div className="flex gap-4 mt-2">
                          {emps.map((emp) => (
                            <Link key={emp.id} href={`/staff/${emp.id}`}>
                              <OrgCard emp={emp} />
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

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
  managerId?: string | null;
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
          <OrgChart employees={data?.data || []} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['employees'] })} />
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
    return <div className="text-center py-20 text-gray-400">No hay empleados registrados</div>;
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
        <span className="text-[9px] text-gray-500 mt-1 text-center">{emp.jobTitle || 'Sin puesto'}</span>
      </div>
    );
  }

  function ManagerPicker({ emp }: { emp: Employee }) {
    return (
      <div className="mt-2 bg-white rounded-lg border border-gray-200 shadow-lg p-3 w-52 z-10 relative">
        <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1.5">Reporta a:</p>
        <select
          value={selectedManagerId || ''}
          onChange={(e) => setSelectedManagerId(e.target.value || null)}
          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:border-[#008080] focus:ring-1 focus:ring-[#008080] mb-2"
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
            className="flex-1 text-[10px] font-medium text-gray-600 py-1 rounded-md border border-gray-200 hover:bg-gray-50"
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
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              title="Cambiar jefe"
            >
              <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
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
            <div className="w-px h-3 bg-gray-300" />
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleCollapse(emp.id); }}
              className="w-5 h-5 rounded-full border border-gray-300 bg-white flex items-center justify-center text-gray-400 hover:border-[#008080] hover:text-[#008080] transition-colors"
              title={collapsedNodes.has(emp.id) ? 'Expandir' : 'Contraer'}
            >
              <span className="text-[10px] font-bold">{collapsedNodes.has(emp.id) ? `+${children.length}` : '−'}</span>
            </button>
            {!collapsedNodes.has(emp.id) && (
              <>
                <div className="w-px h-3 bg-gray-300" />
                {children.length === 1 ? (
                  <OrgNode emp={children[0]} />
                ) : (
                  <>
                    <div className="relative">
                      <div className="h-px bg-gray-300" style={{ width: Math.max(children.length * 140, 140) }} />
                    </div>
                    <div className="flex gap-6">
                      {children.map((child) => (
                        <div key={child.id} className="flex flex-col items-center">
                          <div className="w-px h-6 bg-gray-300" />
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
        <button onClick={expandAll} className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50">Expandir</button>
        <button onClick={collapseAll} className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50">Contraer</button>
        {hasPermission('employees.update') && (
          <button
            onClick={() => { setEditMode(!editMode); setEditingEmpId(null); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${editMode ? 'bg-[#008080] text-white' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
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
          <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} className="px-2.5 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">−</button>
          <span className="text-xs text-gray-500 min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(2, z + 0.1))} className="px-2.5 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">+</button>
          <button onClick={() => setZoom(1)} className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">Reset</button>
        </div>
      </div>

      {/* Org tree */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-auto" style={{ minHeight: 400 }}>
        <div className="flex flex-col items-center py-10 px-8" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', minWidth: 'max-content' }}>
          <OrgNode emp={topRoot} isRoot />

          {/* Unassigned employees */}
          {unassigned.length > 0 && (
            <div className="mt-10 pt-6 border-t-2 border-dashed border-gray-200 w-full">
              <p className="text-xs font-semibold text-gray-400 text-center mb-4">Sin jefe asignado</p>
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
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Asignar jefe"
                        >
                          <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
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

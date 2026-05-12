'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useAuth } from '@/lib/hooks/use-auth';
import { EmployeeScheduleEditor } from '@/components/staff/employee-schedule-editor';
import { DatePicker } from '@/components/ui/date-picker';
import { useCurrency } from '@/lib/hooks/use-currency';
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

      {/* Tabs */}
      <div className="border-b border-gray-200 px-3 md:px-6 overflow-x-auto">
        <nav className="flex gap-1 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
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

      <div className="flex-1 overflow-y-auto p-3 md:p-6">

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

/* ─── Employee Schedules Tab ─── */
function EmployeeSchedulesTab({ employees }: { employees: Employee[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (employees.length === 0) {
    return <div className="text-center py-16 text-gray-400">No hay empleados activos.</div>;
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">Configura el horario laboral de cada empleado.</p>
      <div className="space-y-3">
        {employees.map((employee) => {
          const isExpanded = expandedId === employee.id;
          return (
            <div key={employee.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : employee.id)}
                className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
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
                  <p className="font-medium text-gray-900 text-sm">{employee.firstName} {employee.lastName}</p>
                  <p className="text-xs text-gray-400">{employee.jobTitle || 'Sin puesto'}</p>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isExpanded && (
                <div className="border-t border-gray-100 p-4">
                  <EmployeeScheduleEditor employeeId={employee.id} />
                </div>
              )}
            </div>
          );
        })}
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
      <tr key={record.id} className="border-t border-gray-100 hover:bg-gray-50">
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
              <span className="text-gray-900 text-sm">{emp?.firstName} {emp?.lastName}</span>
              {record.checkInDistance != null && record.checkInDistance > 50 && (
                <p className="text-[10px] text-red-500">{record.checkInDistance}m de distancia</p>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-center font-mono text-gray-700 text-sm">{checkIn || '—'}</td>
        <td className="px-4 py-3 text-center font-mono text-gray-700 text-sm">{checkOut || '—'}</td>
        <td className="px-4 py-3 text-center text-gray-600 text-sm font-mono">{hours || '—'}</td>
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
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {rangeModes.map((mode) => (
              <button
                key={mode.key}
                onClick={() => setRangeMode(mode.key)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  rangeMode === mode.key ? 'bg-[#008080] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
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
              <span className="text-xs text-gray-400">a</span>
              <div className="w-40"><DatePicker value={customEnd} onChange={setCustomEnd} /></div>
            </div>
          )}

          {/* Range label */}
          <span className="text-xs text-gray-400 ml-auto">
            {startDate === endDate
              ? new Date(startDate + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
              : `${new Date(startDate + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })} — ${new Date(endDate + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}`
            }
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>No hay registros de asistencia en este periodo.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rangeMode === 'day' ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-xs text-gray-500 uppercase">
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
              <div key={dateKey} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 capitalize">
                    {new Date(dateKey + 'T12:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/50 border-b border-gray-100">
                    <tr className="text-[10px] text-gray-400 uppercase">
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
    return <div className="text-center py-16 text-gray-400">No hay empleados activos.</div>;
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">Gestiona las comisiones de cada empleado por servicio.</p>
      <div className="space-y-4">
        {employees.map((emp: any) => {
          const empServices = (emp.employeeServices || []) as any[];
          const map = getConfigMap(emp.id, empServices);
          const changed = hasChanges(emp.id, empServices);
          const isExpanded = expandedEmps.has(emp.id);

          return (
            <div key={emp.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setExpandedEmps((prev) => { const n = new Set(prev); n.has(emp.id) ? n.delete(emp.id) : n.add(emp.id); return n; })}
                className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: emp.color || '#008080' }}>
                    {emp.avatarUrl ? <img src={`${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" /> : <>{emp.firstName[0]}{emp.lastName[0]}</>}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{emp.firstName} {emp.lastName}</p>
                    <p className="text-xs text-gray-400">{map.size} de {allServices.length} servicios</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {savedEmpId === emp.id && <span className="text-xs text-green-600 font-medium">Guardado</span>}
                  {changed && <span className="w-2 h-2 rounded-full bg-teal-400 flex-shrink-0" />}
                  <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {isExpanded && (
                <>
                  <div className="max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                        <tr className="text-xs text-gray-500 uppercase">
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
                            <tr key={svc.id} className={`border-t border-gray-100 ${isSelected ? 'bg-teal-50/30' : ''}`}>
                              <td className="px-2 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleService(emp.id, svc.id, empServices)}
                                  className="w-4 h-4 rounded border-gray-300 text-[#008080] focus:ring-[#008080]"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <span className={isSelected ? 'text-gray-900' : 'text-gray-400'}>{svc.name}</span>
                                <span className="text-xs text-gray-400 ml-1">({svc.durationMinutes}min)</span>
                              </td>
                              <td className="px-2 py-2 text-center text-gray-500 tabular-nums">{formatCurrency(price)}</td>
                              <td className="px-2 py-2 text-center">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  disabled={!isSelected}
                                  placeholder="0"
                                  value={config?.commission ?? ''}
                                  onChange={(e) => updateCommission(emp.id, svc.id, e.target.value, empServices)}
                                  className="w-24 text-right text-sm border border-gray-200 rounded px-2 py-1 tabular-nums disabled:bg-gray-50 disabled:text-gray-300 disabled:cursor-not-allowed focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                                />
                              </td>
                              <td className="px-2 py-2 text-center tabular-nums">
                                {isSelected && config?.commission != null ? (
                                  <span className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(profit)}</span>
                                ) : <span className="text-gray-300">--</span>}
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

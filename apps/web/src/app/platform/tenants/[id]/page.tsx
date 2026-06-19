'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { platformApi } from '@/lib/platform-auth';

interface TenantUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  roles: string[];
  hasEmployee: boolean;
}

interface TenantEmployee {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  color: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  locationName: string | null;
  appointmentsCount: number;
}

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string | null;
  businessType: string | null;
  tenantType: 'BUSINESS' | 'FREELANCER';
  address: string | null;
  businessPhone: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  createdAt: string;
  subscription: {
    id: string;
    plan: string;
    status: string;
    monthlyAmountUsd: string;
    contractStartDate: string;
    contractEndDate: string;
    nextBillingDate: string;
    lastPaymentDate: string | null;
    gracePeriodEndsAt: string | null;
  } | null;
  usage: {
    activeEmployees: number;
    appointmentsThisMonth: number;
    activeLocations: number;
  };
  recentInvoices: Array<{
    id: string;
    invoiceNumber: string;
    amountUsd: string;
    status: string;
    periodStart: string;
    periodEnd: string;
    dueDate: string;
    paidAt: string | null;
  }>;
  _count: {
    users: number;
    employees: number;
    appointments: number;
    clients: number;
    services: number;
    locations: number;
  };
  users: TenantUser[];
  employees: TenantEmployee[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
function imgSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_URL}${url}`;
}
function initials(first: string, last: string): string {
  return `${(first || '').charAt(0)}${(last || '').charAt(0)}`.toUpperCase();
}
function waLink(phone: string): string {
  const d = phone.replace(/\D/g, '');
  return `https://wa.me/${d.length === 10 ? '52' + d : d}`;
}

const PLAN_LABELS: Record<string, string> = { BASICO: 'Básico', PLUS: 'Plus', PRO: 'Pro' };
const STATUS_BADGES: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PAST_DUE: 'bg-amber-100 text-amber-700',
  SUSPENDED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-700',
};
const INVOICE_BADGES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  PAID: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  VOID: 'bg-gray-100 text-gray-700',
};
const BUSINESS_LABELS: Record<string, string> = {
  SALON: 'Salón', BARBERIA: 'Barbería', SPA: 'Spa', CLINICA: 'Clínica',
};
const ROLE_LABELS: Record<string, string> = {
  owner: 'Propietario', admin: 'Admin', manager: 'Gerente', receptionist: 'Recepcionista',
  employee: 'Empleado', accountant: 'Contador', viewer: 'Visor',
};

export default function TenantDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmSuspend, setConfirmSuspend] = useState(false);

  // Deactivation modal state
  const [deactivateModal, setDeactivateModal] = useState<{
    employee: TenantEmployee;
    pendingCount: number;
    strategy: 'KEEP' | 'CANCEL' | 'SMART_RESCHEDULE';
    step: 'loading' | 'confirm' | 'processing' | 'done';
    result?: string;
    error?: string;
  } | null>(null);

  const [grantModal, setGrantModal] = useState<{ months: number; saving: boolean; error?: string; success?: string } | null>(null);
  const [empDetail, setEmpDetail] = useState<TenantEmployee | null>(null);
  const [userDetail, setUserDetail] = useState<TenantUser | null>(null);
  const [addrCopied, setAddrCopied] = useState(false);

  async function fetchTenant() {
    try {
      const res = await platformApi.get<{ data: TenantDetail }>(`/api/platform/tenants/${id}`);
      setTenant(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchTenant(); }, [id]);

  async function submitGrantMonths() {
    if (!grantModal) return;
    setGrantModal((prev) => prev ? { ...prev, saving: true, error: undefined } : null);
    try {
      const res = await platformApi.post<{ data: { message: string } }>(
        `/api/platform/tenants/${id}/grant-months`,
        { months: grantModal.months },
      );
      setGrantModal((prev) => prev ? { ...prev, saving: false, success: res.data.message } : null);
      await fetchTenant();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'No se pudo regalar los meses';
      setGrantModal((prev) => prev ? { ...prev, saving: false, error: msg } : null);
    }
  }

  async function handleStatusChange(status: string) {
    setActionLoading(true);
    try {
      await platformApi.patch(`/api/platform/tenants/${id}/status`, { status });
      await fetchTenant();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePlanChange(plan: string) {
    setActionLoading(true);
    try {
      await platformApi.patch(`/api/platform/tenants/${id}/plan`, { plan });
      await fetchTenant();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleInvoiceAction(invoiceId: string, action: 'mark-paid' | 'mark-overdue') {
    setActionLoading(true);
    try {
      await platformApi.post(`/api/platform/invoices/${invoiceId}/${action}`);
      await fetchTenant();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  }

  async function openDeactivateModal(emp: TenantEmployee) {
    setDeactivateModal({ employee: emp, pendingCount: 0, strategy: 'KEEP', step: 'loading' });
    try {
      const res = await platformApi.get<{ data: { pendingCount: number } }>(
        `/api/platform/tenants/${id}/employees/${emp.id}/pending-count`
      );
      setDeactivateModal((prev) =>
        prev ? { ...prev, pendingCount: res.data.pendingCount, step: 'confirm' } : null
      );
    } catch (err: any) {
      setDeactivateModal((prev) =>
        prev ? { ...prev, step: 'confirm', error: err.message || 'Error obteniendo datos' } : null
      );
    }
  }

  async function confirmDeactivate() {
    if (!deactivateModal) return;
    setDeactivateModal((prev) => prev ? { ...prev, step: 'processing', error: undefined } : null);
    try {
      await platformApi.post(
        `/api/platform/tenants/${id}/employees/${deactivateModal.employee.id}/deactivate`,
        { strategy: deactivateModal.strategy }
      );
      setDeactivateModal((prev) =>
        prev ? { ...prev, step: 'done', result: 'Empleado desactivado correctamente' } : null
      );
      await fetchTenant();
    } catch (err: any) {
      setDeactivateModal((prev) =>
        prev ? { ...prev, step: 'confirm', error: err.message || 'Error al desactivar' } : null
      );
    }
  }

  if (loading || !tenant) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div>
      {/* Volver */}
      <Link href="/platform/tenants" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-3">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Volver a cuentas
      </Link>

      {/* Hero: portada + foto de perfil */}
      {(() => {
        const isFreelancer = tenant.tenantType === 'FREELANCER';
        const accent = isFreelancer ? '#7c3aed' : '#2563eb';
        const cover = imgSrc(tenant.coverImageUrl);
        const logo = imgSrc(tenant.logoUrl);
        return (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
            <div
              className="h-28 sm:h-36 bg-cover bg-center"
              style={cover ? { backgroundImage: `url(${cover})` } : { background: `linear-gradient(135deg, ${accent}, ${accent}99)` }}
            />
            <div className="px-5 sm:px-6 pb-5">
              <div className="flex items-end gap-4 -mt-12">
                <div
                  className="w-24 h-24 rounded-2xl border-4 border-white shadow-sm overflow-hidden flex items-center justify-center text-2xl font-bold text-white shrink-0"
                  style={{ backgroundColor: accent }}
                >
                  {logo ? <img src={logo} alt={tenant.name} className="w-full h-full object-cover" /> : initials(tenant.name, tenant.name.split(' ')[1] || '')}
                </div>
                {tenant.subscription && (
                  <span className={`mb-2 text-xs font-medium px-3 py-1 rounded-full ${STATUS_BADGES[tenant.subscription.status] || 'bg-gray-100 text-gray-600'}`}>
                    {tenant.subscription.status}
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                  isFreelancer ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isFreelancer ? 'bg-purple-500' : 'bg-blue-500'}`} />
                  {isFreelancer ? 'Independiente' : 'Negocio'}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{tenant.email} · /{tenant.slug}</p>
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Business info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Información</h2>
            <div className="space-y-3 text-sm">
              {/* Rubro */}
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-gray-50 text-gray-400 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5a2 2 0 011.414.586l7 7a2 2 0 010 2.828l-5 5a2 2 0 01-2.828 0l-7-7A2 2 0 014 9V4a1 1 0 011-1z" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">Rubro</p>
                  <p className="font-medium text-gray-900">{tenant.businessType ? tenant.businessType.split(',').map((b) => BUSINESS_LABELS[b] || b).join(', ') : 'Sin rubro'}</p>
                </div>
              </div>

              {/* Teléfono en una sola línea */}
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-gray-50 text-gray-400 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400">Teléfono</p>
                  <p className="font-medium text-gray-900 truncate">{tenant.phone || tenant.businessPhone || 'Sin teléfono'}</p>
                </div>
                {(tenant.phone || tenant.businessPhone) && (
                  <a href={waLink((tenant.phone || tenant.businessPhone)!)} target="_blank" rel="noopener noreferrer" title="WhatsApp"
                    className="w-8 h-8 rounded-lg border border-gray-200 text-gray-400 hover:text-green-600 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.748-.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" /></svg>
                  </a>
                )}
              </div>

              {/* Dirección con ícono + copiar */}
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-gray-50 text-gray-400 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400">Dirección</p>
                  <p className="font-medium text-gray-900 truncate">{tenant.address || 'Sin dirección'}</p>
                </div>
                {tenant.address && (
                  <button
                    onClick={() => { navigator.clipboard?.writeText(tenant.address!).catch(() => {}); setAddrCopied(true); setTimeout(() => setAddrCopied(false), 1800); }}
                    title="Copiar dirección"
                    className={`shrink-0 text-xs font-medium px-2 py-1.5 rounded-lg border ${addrCopied ? 'border-teal-200 text-teal-700 bg-teal-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                  >
                    {addrCopied ? '¡Copiado!' : 'Copiar'}
                  </button>
                )}
              </div>

              {/* Registro */}
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-gray-50 text-gray-400 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
                <div>
                  <p className="text-xs text-gray-400">Registro</p>
                  <p className="font-medium text-gray-900">{new Date(tenant.createdAt).toLocaleDateString('es')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Usage */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Uso actual</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{tenant.usage.activeEmployees}</p>
                <p className="text-xs text-gray-500">Empleados activos</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{tenant.usage.appointmentsThisMonth}</p>
                <p className="text-xs text-gray-500">Citas este mes</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{tenant.usage.activeLocations}</p>
                <p className="text-xs text-gray-500">Ubicaciones</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-sm text-center">
              <div><span className="font-semibold">{tenant._count.users}</span><br/><span className="text-gray-500">Usuarios</span></div>
              <div><span className="font-semibold">{tenant._count.clients}</span><br/><span className="text-gray-500">Clientes</span></div>
              <div><span className="font-semibold">{tenant._count.services}</span><br/><span className="text-gray-500">Servicios</span></div>
              <div><span className="font-semibold">{tenant._count.appointments}</span><br/><span className="text-gray-500">Citas total</span></div>
            </div>
          </div>

          {/* Users */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Usuarios <span className="text-sm font-normal text-gray-400">({tenant.users.length})</span>
            </h2>
            {tenant.users.length === 0 ? (
              <p className="text-sm text-gray-400">Sin usuarios</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {tenant.users.map((user) => {
                  const av = imgSrc(user.avatarUrl);
                  return (
                    <button
                      key={user.id}
                      onClick={() => setUserDetail(user)}
                      className="text-left flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-teal-200 hover:shadow-sm transition-all"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-semibold shrink-0">
                        {av ? <img src={av} alt="" className="w-full h-full object-cover" /> : initials(user.firstName, user.lastName)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{user.firstName} {user.lastName}</p>
                        <p className="text-[11px] text-gray-400 truncate">{ROLE_LABELS[user.roles[0]] || user.roles[0] || 'Usuario'}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Employees */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Empleados <span className="text-sm font-normal text-gray-400">({tenant.employees.length})</span>
            </h2>
            {tenant.employees.length === 0 ? (
              <p className="text-sm text-gray-400">Sin empleados</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {tenant.employees.map((emp) => {
                  const av = imgSrc(emp.avatarUrl);
                  return (
                    <button
                      key={emp.id}
                      onClick={() => setEmpDetail(emp)}
                      className="text-left flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-teal-200 hover:shadow-sm transition-all"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-sm font-semibold text-white shrink-0" style={{ backgroundColor: emp.color || '#008080' }}>
                        {av ? <img src={av} alt="" className="w-full h-full object-cover" /> : initials(emp.firstName, emp.lastName)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{emp.firstName} {emp.lastName}</p>
                        <p className="text-[11px] text-gray-400 truncate">{emp.jobTitle || (emp.isActive ? 'Activo' : 'Inactivo')}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Invoices */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Facturas recientes</h2>
            {tenant.recentInvoices.length === 0 ? (
              <p className="text-sm text-gray-400">Sin facturas</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase border-b">
                    <th className="pb-2">N. Factura</th>
                    <th className="pb-2">Monto</th>
                    <th className="pb-2">Estado</th>
                    <th className="pb-2">Vencimiento</th>
                    <th className="pb-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tenant.recentInvoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-gray-50">
                      <td className="py-2 font-medium">{inv.invoiceNumber}</td>
                      <td className="py-2">${Number(inv.amountUsd).toFixed(2)}</td>
                      <td className="py-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${INVOICE_BADGES[inv.status] || ''}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-2 text-gray-500">{new Date(inv.dueDate).toLocaleDateString('es')}</td>
                      <td className="py-2 text-right space-x-2">
                        {inv.status === 'PENDING' && (
                          <>
                            <button onClick={() => handleInvoiceAction(inv.id, 'mark-paid')}
                              disabled={actionLoading} className="text-xs text-green-600 hover:text-green-700 font-medium">Pagada</button>
                            <button onClick={() => handleInvoiceAction(inv.id, 'mark-overdue')}
                              disabled={actionLoading} className="text-xs text-red-600 hover:text-red-700 font-medium">Vencida</button>
                          </>
                        )}
                        {inv.status === 'OVERDUE' && (
                          <button onClick={() => handleInvoiceAction(inv.id, 'mark-paid')}
                            disabled={actionLoading} className="text-xs text-green-600 hover:text-green-700 font-medium">Marcar pagada</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right column - Actions */}
        <div className="space-y-6">
          {tenant.subscription && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Suscripción</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Plan:</span>
                  <span className="font-semibold">{PLAN_LABELS[tenant.subscription.plan] || tenant.subscription.plan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Precio:</span>
                  <span className="font-semibold">${tenant.tenantType === 'FREELANCER' ? '300' : '500'} MXN/mes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Próximo cobro:</span>
                  <span>{new Date(tenant.subscription.nextBillingDate).toLocaleDateString('es')}</span>
                </div>
                {tenant.subscription.lastPaymentDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Último pago:</span>
                    <span>{new Date(tenant.subscription.lastPaymentDate).toLocaleDateString('es')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Cambiar plan</h2>
            <div className="space-y-2">
              {(['BASICO', 'PLUS', 'PRO'] as const).map((plan) => (
                <button key={plan} onClick={() => handlePlanChange(plan)}
                  disabled={actionLoading || tenant.subscription?.plan === plan}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                    tenant.subscription?.plan === plan
                      ? 'border-primary-300 bg-primary-50 text-primary-700 font-medium'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  } disabled:opacity-50`}>
                  {PLAN_LABELS[plan]}
                  {tenant.subscription?.plan === plan && ' (actual)'}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Estado</h2>
            <div className="space-y-2">
              <button onClick={() => setGrantModal({ months: 1, saving: false })} disabled={actionLoading}
                className="w-full px-3 py-2 bg-[#008080] text-white rounded-lg text-sm font-medium hover:bg-[#006666] disabled:opacity-50">
                Regalar meses
              </button>
              {tenant.subscription?.status !== 'ACTIVE' && (
                <button onClick={() => handleStatusChange('ACTIVE')} disabled={actionLoading}
                  className="w-full px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  Habilitar
                </button>
              )}
              {tenant.subscription?.status !== 'SUSPENDED' && !confirmSuspend && (
                <button onClick={() => setConfirmSuspend(true)} disabled={actionLoading}
                  className="w-full px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                  Deshabilitar
                </button>
              )}
              {confirmSuspend && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
                  <p className="text-sm text-red-700 font-medium">La cuenta perderá acceso inmediatamente. ¿Confirmar?</p>
                  <div className="flex gap-2">
                    <button onClick={() => { handleStatusChange('SUSPENDED'); setConfirmSuspend(false); }} disabled={actionLoading}
                      className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                      Sí, deshabilitar
                    </button>
                    <button onClick={() => setConfirmSuspend(false)}
                      className="flex-1 px-3 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Deactivate Employee Modal */}
      {deactivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Desactivar empleado
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {deactivateModal.employee.firstName} {deactivateModal.employee.lastName}
            </p>

            {deactivateModal.step === 'loading' && (
              <div className="flex items-center justify-center py-8">
                <svg className="animate-spin h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="ml-2 text-sm text-gray-500">Verificando citas pendientes...</span>
              </div>
            )}

            {deactivateModal.step === 'confirm' && (
              <div className="space-y-4">
                {deactivateModal.error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {deactivateModal.error}
                  </div>
                )}

                {deactivateModal.pendingCount === 0 ? (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-700">
                      Este empleado no tiene citas pendientes. Se puede desactivar directamente.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-700 font-medium">
                        Este empleado tiene {deactivateModal.pendingCount} cita{deactivateModal.pendingCount !== 1 ? 's' : ''} pendiente{deactivateModal.pendingCount !== 1 ? 's' : ''}.
                      </p>
                      <p className="text-xs text-amber-600 mt-1">Selecciona qué hacer con las citas:</p>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                          type="radio"
                          name="strategy"
                          value="SMART_RESCHEDULE"
                          checked={deactivateModal.strategy === 'SMART_RESCHEDULE'}
                          onChange={() => setDeactivateModal((prev) => prev ? { ...prev, strategy: 'SMART_RESCHEDULE' } : null)}
                          className="mt-0.5"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Reasignar automáticamente</p>
                          <p className="text-xs text-gray-500">Busca otros empleados disponibles para cada cita</p>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                          type="radio"
                          name="strategy"
                          value="CANCEL"
                          checked={deactivateModal.strategy === 'CANCEL'}
                          onChange={() => setDeactivateModal((prev) => prev ? { ...prev, strategy: 'CANCEL' } : null)}
                          className="mt-0.5"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Cancelar todas las citas</p>
                          <p className="text-xs text-gray-500">Se cancelan las citas pendientes del empleado</p>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                          type="radio"
                          name="strategy"
                          value="KEEP"
                          checked={deactivateModal.strategy === 'KEEP'}
                          onChange={() => setDeactivateModal((prev) => prev ? { ...prev, strategy: 'KEEP' } : null)}
                          className="mt-0.5"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Solo desactivar</p>
                          <p className="text-xs text-gray-500">Desactiva al empleado sin tocar sus citas</p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={confirmDeactivate}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                  >
                    Confirmar desactivación
                  </button>
                  <button
                    onClick={() => setDeactivateModal(null)}
                    className="flex-1 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {deactivateModal.step === 'processing' && (
              <div className="flex items-center justify-center py-8">
                <svg className="animate-spin h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="ml-2 text-sm text-gray-500">Desactivando empleado...</span>
              </div>
            )}

            {deactivateModal.step === 'done' && (
              <div className="space-y-4">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700 font-medium">{deactivateModal.result}</p>
                </div>
                <button
                  onClick={() => setDeactivateModal(null)}
                  className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grant Months Modal */}
      {grantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Regalar meses</h3>
            <p className="text-sm text-gray-500 mb-4">{tenant.name}</p>

            {grantModal.success ? (
              <div className="space-y-4">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700 font-medium">{grantModal.success}</p>
                </div>
                <button
                  onClick={() => setGrantModal(null)}
                  className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Meses a regalar</label>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[1, 3, 6, 12].map((m) => (
                      <button
                        key={m}
                        onClick={() => setGrantModal((prev) => prev ? { ...prev, months: m } : null)}
                        className={`py-2 rounded-lg text-sm font-medium border ${
                          grantModal.months === m
                            ? 'bg-[#008080] text-white border-[#008080]'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {m} {m === 1 ? 'mes' : 'meses'}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={grantModal.months}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setGrantModal((prev) => prev ? { ...prev, months: Number.isFinite(v) ? v : 1 } : null);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Cantidad personalizada (1-60)"
                  />
                </div>

                <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-800">
                  La cuenta pasará a estado <strong>Prueba</strong> y la próxima fecha de cobro se moverá {grantModal.months} mes{grantModal.months !== 1 ? 'es' : ''} más adelante. No se generarán cobros durante ese período.
                </div>

                {grantModal.error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {grantModal.error}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={submitGrantMonths}
                    disabled={grantModal.saving || grantModal.months < 1 || grantModal.months > 60}
                    className="flex-1 px-4 py-2 bg-[#008080] text-white rounded-lg text-sm font-medium hover:bg-[#006666] disabled:opacity-50"
                  >
                    {grantModal.saving ? 'Aplicando...' : 'Confirmar'}
                  </button>
                  <button
                    onClick={() => setGrantModal(null)}
                    disabled={grantModal.saving}
                    className="flex-1 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detalle de empleado (soporte super-admin) */}
      {empDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setEmpDetail(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-white text-lg font-bold shrink-0" style={{ backgroundColor: empDetail.color || '#008080' }}>
                {imgSrc(empDetail.avatarUrl) ? <img src={imgSrc(empDetail.avatarUrl)!} alt="" className="w-full h-full object-cover" /> : initials(empDetail.firstName, empDetail.lastName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-gray-900">{empDetail.firstName} {empDetail.lastName}</p>
                <p className="text-xs text-gray-500">{empDetail.jobTitle || 'Empleado'}</p>
                <span className={`inline-block mt-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${empDetail.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {empDetail.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <button onClick={() => setEmpDetail(null)} className="text-gray-400 hover:text-gray-600 p-1 -mr-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-50">
                <span className="text-gray-400">Email</span>
                <span className="font-medium text-gray-900 truncate">{empDetail.email || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-50">
                <span className="text-gray-400">Teléfono</span>
                <span className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{empDetail.phone || '—'}</span>
                  {empDetail.phone && (
                    <a href={waLink(empDetail.phone)} target="_blank" rel="noopener noreferrer" className="text-green-600" title="WhatsApp">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.748-.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" /></svg>
                    </a>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-50">
                <span className="text-gray-400">Ubicación</span>
                <span className="font-medium text-gray-900 truncate">{empDetail.locationName || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2 py-1.5">
                <span className="text-gray-400">Citas totales</span>
                <span className="font-medium text-gray-900">{empDetail.appointmentsCount}</span>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-teal-50 border border-teal-100 text-[11px] text-teal-800">
              Como super-admin puedes dar soporte sobre este empleado. Más acciones de edición se pueden habilitar aquí.
            </div>

            <div className="flex gap-2 mt-4">
              {empDetail.isActive && (
                <button
                  onClick={() => { const e = empDetail; setEmpDetail(null); openDeactivateModal(e); }}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                >
                  Desactivar empleado
                </button>
              )}
              <button onClick={() => setEmpDetail(null)} className="flex-1 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detalle de usuario */}
      {userDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setUserDetail(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 text-gray-600 flex items-center justify-center text-lg font-bold shrink-0">
                {imgSrc(userDetail.avatarUrl) ? <img src={imgSrc(userDetail.avatarUrl)!} alt="" className="w-full h-full object-cover" /> : initials(userDetail.firstName, userDetail.lastName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-gray-900">{userDetail.firstName} {userDetail.lastName}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {userDetail.roles.map((r) => (
                    <span key={r} className="text-[11px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{ROLE_LABELS[r] || r}</span>
                  ))}
                </div>
              </div>
              <button onClick={() => setUserDetail(null)} className="text-gray-400 hover:text-gray-600 p-1 -mr-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-50">
                <span className="text-gray-400">Email</span>
                <a href={`mailto:${userDetail.email}`} className="font-medium text-gray-900 truncate hover:text-[#008080]">{userDetail.email}</a>
              </div>
              <div className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-50">
                <span className="text-gray-400">Teléfono</span>
                <span className="font-medium text-gray-900">{userDetail.phone || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-50">
                <span className="text-gray-400">Último acceso</span>
                <span className="font-medium text-gray-900">{userDetail.lastLoginAt ? new Date(userDetail.lastLoginAt).toLocaleString('es', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Nunca'}</span>
              </div>
              <div className="flex items-center justify-between gap-2 py-1.5">
                <span className="text-gray-400">Estado</span>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${userDetail.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {userDetail.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
            <button onClick={() => setUserDetail(null)} className="mt-4 w-full px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

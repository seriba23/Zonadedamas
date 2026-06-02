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
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/platform/tenants" className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              tenant.tenantType === 'FREELANCER' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${tenant.tenantType === 'FREELANCER' ? 'bg-purple-500' : 'bg-blue-500'}`} />
              {tenant.tenantType === 'FREELANCER' ? 'Independiente' : 'Negocio'}
            </span>
          </div>
          <p className="text-sm text-gray-500">{tenant.email} | {tenant.slug}</p>
        </div>
        {tenant.subscription && (
          <span className={`ml-auto text-sm font-medium px-3 py-1 rounded-full ${STATUS_BADGES[tenant.subscription.status] || ''}`}>
            {tenant.subscription.status}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Business info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Información</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Tipo:</span> <span className="font-medium">{tenant.businessType ? BUSINESS_LABELS[tenant.businessType] || tenant.businessType : '-'}</span></div>
              <div><span className="text-gray-500">Teléfono:</span> <span className="font-medium">{tenant.phone || tenant.businessPhone || '-'}</span></div>
              <div><span className="text-gray-500">Dirección:</span> <span className="font-medium">{tenant.address || '-'}</span></div>
              <div><span className="text-gray-500">Registro:</span> <span className="font-medium">{new Date(tenant.createdAt).toLocaleDateString('es')}</span></div>
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
            <div className="grid grid-cols-4 gap-4 mt-4 text-sm text-center">
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 uppercase border-b">
                      <th className="pb-2">Nombre</th>
                      <th className="pb-2">Email</th>
                      <th className="pb-2">Teléfono</th>
                      <th className="pb-2">Roles</th>
                      <th className="pb-2">Último acceso</th>
                      <th className="pb-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenant.users.map((user) => (
                      <tr key={user.id} className="border-b border-gray-50">
                        <td className="py-2 font-medium">
                          {user.firstName} {user.lastName}
                          {user.hasEmployee && (
                            <span className="ml-1 text-xs text-blue-500" title="Vinculado a empleado">E</span>
                          )}
                        </td>
                        <td className="py-2 text-gray-600">{user.email}</td>
                        <td className="py-2 text-gray-500">{user.phone || '-'}</td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1">
                            {user.roles.map((role) => (
                              <span key={role} className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                                {ROLE_LABELS[role] || role}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 text-gray-500 text-xs">
                          {user.lastLoginAt
                            ? new Date(user.lastLoginAt).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                            : 'Nunca'}
                        </td>
                        <td className="py-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            user.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {user.isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 uppercase border-b">
                      <th className="pb-2">Nombre</th>
                      <th className="pb-2">Email</th>
                      <th className="pb-2">Teléfono</th>
                      <th className="pb-2">Ubicación</th>
                      <th className="pb-2">Citas</th>
                      <th className="pb-2">Estado</th>
                      <th className="pb-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenant.employees.map((emp) => (
                      <tr key={emp.id} className="border-b border-gray-50">
                        <td className="py-2 font-medium">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: emp.color }}
                            />
                            {emp.firstName} {emp.lastName}
                          </span>
                        </td>
                        <td className="py-2 text-gray-600">{emp.email || '-'}</td>
                        <td className="py-2 text-gray-500">{emp.phone || '-'}</td>
                        <td className="py-2 text-gray-500">{emp.locationName || '-'}</td>
                        <td className="py-2 text-gray-600">{emp.appointmentsCount}</td>
                        <td className="py-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            emp.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {emp.isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="py-2 text-right">
                          {emp.isActive && (
                            <button
                              onClick={() => openDeactivateModal(emp)}
                              className="text-xs text-red-600 hover:text-red-700 font-medium"
                            >
                              Desactivar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                  <span className="font-semibold">${Number(tenant.subscription.monthlyAmountUsd).toFixed(2)}/mes</span>
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
    </div>
  );
}

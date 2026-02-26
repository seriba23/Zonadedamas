'use client';

import { useState, useEffect, useCallback } from 'react';
import { platformApi } from '@/lib/platform-auth';

interface Invoice {
  id: string;
  invoiceNumber: string;
  amountUsd: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  paidAt: string | null;
  tenant: { id: string; name: string; slug: string };
}

interface Meta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

const STATUS_BADGES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  PAID: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  VOID: 'bg-gray-100 text-gray-700',
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('perPage', '20');
      if (filterStatus) params.set('status', filterStatus);

      const res = await platformApi.get<{ data: Invoice[]; meta: Meta }>(
        `/api/platform/invoices?${params.toString()}`,
      );
      setInvoices(res.data);
      setMeta(res.meta);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  useEffect(() => { setPage(1); }, [filterStatus]);

  async function handleAction(invoiceId: string, action: 'mark-paid' | 'mark-overdue') {
    setActionLoading(true);
    try {
      await platformApi.post(`/api/platform/invoices/${invoiceId}/${action}`);
      await fetchInvoices();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Facturas</h1>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">Todos los estados</option>
          <option value="PENDING">Pendiente</option>
          <option value="PAID">Pagada</option>
          <option value="OVERDUE">Vencida</option>
          <option value="VOID">Anulada</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">N. Factura</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Negocio</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Monto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Período</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Vencimiento</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">Cargando...</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">No se encontraron facturas</td></tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{inv.tenant.name}</p>
                      <p className="text-xs text-gray-500">{inv.tenant.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      ${Number(inv.amountUsd).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGES[inv.status] || 'bg-gray-100'}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(inv.periodStart).toLocaleDateString('es')} - {new Date(inv.periodEnd).toLocaleDateString('es')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(inv.dueDate).toLocaleDateString('es')}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {inv.status === 'PENDING' && (
                        <>
                          <button onClick={() => handleAction(inv.id, 'mark-paid')}
                            disabled={actionLoading} className="text-xs text-green-600 hover:text-green-700 font-medium">Pagada</button>
                          <button onClick={() => handleAction(inv.id, 'mark-overdue')}
                            disabled={actionLoading} className="text-xs text-red-600 hover:text-red-700 font-medium">Vencida</button>
                        </>
                      )}
                      {inv.status === 'OVERDUE' && (
                        <button onClick={() => handleAction(inv.id, 'mark-paid')}
                          disabled={actionLoading} className="text-xs text-green-600 hover:text-green-700 font-medium">Marcar pagada</button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-500">{meta.total} facturas totales</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50">Anterior</button>
              <span className="px-3 py-1 text-sm text-gray-600">{page} / {meta.totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50">Siguiente</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// /platform/reports — Consola de REPORTES / DENUNCIAS del super-admin.
//
// Muestra los reportes que cualquier rol (negocio, profesional, cliente) envía a
// la plataforma. El super-admin los revisa y cambia su estado + notas.
//   GET   /api/platform/reports?status=...
//   PATCH /api/platform/reports/:id  { status, adminNotes }
// ============================================================
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformApi } from '@/lib/platform-auth';

interface Report {
  id: string;
  reporterType: string;
  reporterName: string | null;
  targetType: string;
  targetName: string | null;
  tenantId: string | null;
  reason: string;
  description: string | null;
  status: 'PENDING' | 'REVIEWED' | 'DISMISSED' | 'ACTION_TAKEN';
  adminNotes: string | null;
  createdAt: string;
}

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'Todos' },
  { key: 'PENDING', label: 'Pendientes' },
  { key: 'REVIEWED', label: 'Revisados' },
  { key: 'ACTION_TAKEN', label: 'Con acción' },
  { key: 'DISMISSED', label: 'Desestimados' },
];

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  REVIEWED: 'Revisado',
  ACTION_TAKEN: 'Con acción',
  DISMISSED: 'Desestimado',
};
const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  REVIEWED: 'bg-teal-50 text-teal-700 border-teal-200',
  ACTION_TAKEN: 'bg-green-50 text-green-700 border-green-200',
  DISMISSED: 'bg-gray-100 text-gray-500 border-gray-200',
};

export default function PlatformReportsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['platform-reports', statusFilter],
    queryFn: async () => {
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      const res = await platformApi.get<{ data: Report[] }>(`/api/platform/reports${qs}`);
      return res.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, adminNotes }: { id: string; status: string; adminNotes?: string }) =>
      platformApi.patch(`/api/platform/reports/${id}`, { status, adminNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-reports'] });
      setEditing(null);
      setNotes('');
    },
  });

  const reports = data || [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Reportes y denuncias</h1>
      <p className="text-sm text-gray-500 mb-5">Reportes enviados por negocios, profesionales y clientes. Revísalos y marca el estado.</p>

      {/* Filtros por estado */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${statusFilter === f.key ? 'bg-[#008080] text-white border-[#008080]' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-gray-400">Cargando...</div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">No hay reportes.</div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{r.reason}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    <span className="font-medium">{r.reporterName || r.reporterType}</span> ({r.reporterType}) reportó a{' '}
                    <span className="font-medium">{r.targetName || r.targetType}</span> ({r.targetType})
                  </p>
                  {r.description && <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{r.description}</p>}
                  <p className="text-[11px] text-gray-400 mt-1">{new Date(r.createdAt).toLocaleString('es-MX')}</p>
                  {r.adminNotes && <p className="text-xs text-gray-500 mt-2"><span className="font-medium">Notas:</span> {r.adminNotes}</p>}
                </div>
                <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold border ${STATUS_STYLE[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
              </div>

              {/* Acciones */}
              {editing === r.id ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Notas internas (opcional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/20"
                  />
                  <div className="flex flex-wrap gap-2">
                    {(['REVIEWED', 'ACTION_TAKEN', 'DISMISSED', 'PENDING'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => updateMutation.mutate({ id: r.id, status: st, adminNotes: notes })}
                        disabled={updateMutation.isPending}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Marcar {STATUS_LABEL[st]}
                      </button>
                    ))}
                    <button onClick={() => { setEditing(null); setNotes(''); }} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500">Cancelar</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setEditing(r.id); setNotes(r.adminNotes || ''); }}
                  className="mt-3 text-xs font-medium text-[#008080] hover:text-[#006666]"
                >
                  Gestionar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

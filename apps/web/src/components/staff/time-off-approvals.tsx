'use client';

// ─────────────────────────────────────────────────────────────────────────────
// TimeOffApprovals — pantalla del ADMIN para aprobar/rechazar los permisos de
// ausencia que solicitan los empleados. Vive en la pestaña "Permisos" de
// Personal. Las solicitudes pendientes salen arriba con acciones; debajo el
// historial (aprobadas/rechazadas).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { showSaveSuccess } from '@/lib/save-toast';
import { Modal } from '@/components/ui/modal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface TimeOffRequest {
  id: string;
  employeeId: string;
  startDatetime: string;
  endDatetime: string;
  reason?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
  createdAt: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    color?: string | null;
    avatarUrl?: string | null;
    jobTitle?: string | null;
  };
}

// Formatea un rango de fechas legible (ej. "23 jun 2026, 09:00 → 25 jun 2026, 18:00").
function fmt(dt: string): string {
  return new Date(dt).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Avatar circular del empleado (foto o iniciales sobre su color).
function EmployeeAvatar({ emp }: { emp: TimeOffRequest['employee'] }) {
  return (
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
  );
}

// Badge de estado con los colores del proyecto (nunca ámbar/naranja: teal).
function StatusBadge({ status }: { status: TimeOffRequest['status'] }) {
  const map: Record<TimeOffRequest['status'], { label: string; cls: string }> = {
    PENDING: { label: 'Pendiente', cls: 'bg-teal-50 text-teal-700 border border-teal-200' },
    APPROVED: { label: 'Aprobado', cls: 'bg-green-50 text-green-700 border border-green-200' },
    REJECTED: { label: 'Rechazado', cls: 'bg-red-50 text-red-600 border border-red-200' },
  };
  const s = map[status];
  return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${s.cls}`}>{s.label}</span>;
}

export function TimeOffApprovals() {
  const queryClient = useQueryClient();
  // Solicitud que se está rechazando (para pedir el motivo en un modal).
  const [rejecting, setRejecting] = useState<TimeOffRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['time-off-requests'],
    queryFn: async () => {
      const res = await api.get<{ data: TimeOffRequest[] }>('/api/employees/time-off-requests');
      return res.data || [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: (req: TimeOffRequest) =>
      api.put(`/api/employees/${req.employeeId}/time-off/${req.id}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-off-requests'] });
      // El calendario también pinta los permisos: refrescamos por si acaso.
      queryClient.invalidateQueries({ queryKey: ['time-offs'] });
      showSaveSuccess({ title: 'Permiso aprobado' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ req, reason }: { req: TimeOffRequest; reason: string }) =>
      api.put(`/api/employees/${req.employeeId}/time-off/${req.id}/reject`, { rejectionReason: reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-off-requests'] });
      queryClient.invalidateQueries({ queryKey: ['time-offs'] });
      setRejecting(null);
      setRejectionReason('');
      showSaveSuccess({ title: 'Permiso rechazado' });
    },
  });

  const requests = data || [];
  const pending = requests.filter((r) => r.status === 'PENDING');
  const history = requests.filter((r) => r.status !== 'PENDING');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-gray-200 border-t-[#008080] rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Pendientes ─── */}
      <div>
        <h2 className="text-sm font-bold text-gray-900 mb-3">
          Solicitudes pendientes {pending.length > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-[#008080] text-white">{pending.length}</span>
          )}
        </h2>

        {pending.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 px-6 py-10 text-center text-sm text-gray-400">
            No hay solicitudes pendientes de aprobación.
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((req) => (
              <div key={req.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  <EmployeeAvatar emp={req.employee} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{req.employee.firstName} {req.employee.lastName}</p>
                      <StatusBadge status={req.status} />
                    </div>
                    <p className="text-sm text-gray-700 mt-1">{fmt(req.startDatetime)} → {fmt(req.endDatetime)}</p>
                    {req.reason && <p className="text-xs text-gray-500 mt-1">Motivo: {req.reason}</p>}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => { setRejecting(req); setRejectionReason(''); }}
                    disabled={approveMutation.isPending}
                    className="px-4 py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                  <button
                    onClick={() => approveMutation.mutate(req)}
                    disabled={approveMutation.isPending}
                    className="px-4 py-1.5 text-sm font-medium rounded-lg text-white bg-[#008080] hover:bg-[#006666] disabled:opacity-50"
                  >
                    {approveMutation.isPending ? 'Aprobando...' : 'Aprobar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Historial ─── */}
      {history.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-3">Historial</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-50">
            {history.map((req) => (
              <div key={req.id} className="flex items-center gap-3 px-4 py-3">
                <EmployeeAvatar emp={req.employee} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">{req.employee.firstName} {req.employee.lastName}</p>
                    <StatusBadge status={req.status} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{fmt(req.startDatetime)} → {fmt(req.endDatetime)}</p>
                  {req.status === 'REJECTED' && req.rejectionReason && (
                    <p className="text-xs text-red-500 mt-0.5">Motivo del rechazo: {req.rejectionReason}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Modal: motivo del rechazo ─── */}
      {rejecting && (
        <Modal title="Rechazar solicitud" onClose={() => setRejecting(null)} size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Indica el motivo del rechazo para <span className="font-medium text-gray-900">{rejecting.employee.firstName} {rejecting.employee.lastName}</span>. El empleado lo verá en su notificación.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              placeholder="Ej. Coincide con una fecha de alta demanda."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setRejecting(null)}
                className="px-4 py-1.5 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => rejectMutation.mutate({ req: rejecting, reason: rejectionReason.trim() })}
                disabled={!rejectionReason.trim() || rejectMutation.isPending}
                className="px-4 py-1.5 text-sm font-medium rounded-lg text-white bg-red-500 hover:bg-red-600 disabled:opacity-50"
              >
                {rejectMutation.isPending ? 'Rechazando...' : 'Rechazar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Modal } from '@/components/ui/modal';

interface NotificationTemplate {
  id: string;
  tenantId: string;
  type: 'EMAIL' | 'WHATSAPP';
  eventTrigger: string;
  subject: string | null;
  bodyTemplate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NotificationLog {
  id: string;
  channel: 'EMAIL' | 'WHATSAPP';
  eventName: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  subject: string | null;
  status: 'SENT' | 'FAILED';
  error: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface PreviewData {
  subject: string;
  body: string;
  variables: Record<string, string>;
}

const EVENT_LABELS: Record<string, string> = {
  'appointment.created': 'Cita creada',
  'appointment.confirmed': 'Cita confirmada',
  'appointment.rescheduled': 'Cita reagendada',
  'appointment.cancelled': 'Cita cancelada',
  'appointment.completed': 'Cita completada',
  'payment.completed': 'Pago completado',
};

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
};

const EVENT_VARIABLES: Record<string, string[]> = {
  'appointment.created': [
    'clientName',
    'clientFirstName',
    'employeeName',
    'services',
    'totalPrice',
    'date',
    'time',
  ],
  'appointment.confirmed': [
    'clientName',
    'clientFirstName',
    'employeeName',
    'services',
    'date',
    'time',
  ],
  'appointment.rescheduled': [
    'clientName',
    'clientFirstName',
    'employeeName',
    'services',
    'oldDate',
    'newDate',
    'newTime',
  ],
  'appointment.cancelled': [
    'clientName',
    'clientFirstName',
    'employeeName',
    'services',
    'date',
    'time',
  ],
  'appointment.completed': [
    'clientName',
    'clientFirstName',
    'employeeName',
    'services',
    'date',
    'time',
  ],
  'payment.completed': [
    'clientName',
    'clientFirstName',
    'amount',
    'currency',
    'paymentMethod',
    'date',
  ],
};

type TabId = 'logs' | 'templates';

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('logs');
  const [editTemplate, setEditTemplate] = useState<NotificationTemplate | null>(
    null,
  );
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [logsPage, setLogsPage] = useState(1);

  // Fetch templates
  const { data: templatesRes, isLoading: loadingTemplates } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: () =>
      api.get<{ data: NotificationTemplate[] }>(
        '/api/notifications/templates',
      ),
  });

  // Fetch logs
  const { data: logsRes, isLoading: loadingLogs } = useQuery({
    queryKey: ['notification-logs', logsPage],
    queryFn: () =>
      api.get<{
        data: NotificationLog[];
        meta: { total: number; page: number; perPage: number; totalPages: number };
      }>(`/api/notifications/logs?page=${logsPage}&perPage=15`),
    enabled: activeTab === 'logs',
  });

  // Toggle active mutation
  const toggleMutation = useMutation({
    mutationFn: (template: NotificationTemplate) =>
      api.put(`/api/notifications/templates/${template.id}`, {
        isActive: !template.isActive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
    },
  });

  // Update template mutation
  const updateMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      subject?: string;
      bodyTemplate?: string;
    }) => api.put(`/api/notifications/templates/${payload.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
      setEditTemplate(null);
    },
  });

  const templates = templatesRes?.data || [];
  const logs = logsRes?.data || [];
  const logsMeta = logsRes?.meta;

  // Group templates by event trigger
  const grouped = templates.reduce(
    (acc, t) => {
      if (!acc[t.eventTrigger]) acc[t.eventTrigger] = [];
      acc[t.eventTrigger].push(t);
      return acc;
    },
    {} as Record<string, NotificationTemplate[]>,
  );

  function openEdit(template: NotificationTemplate) {
    setEditTemplate(template);
    setEditSubject(template.subject || '');
    setEditBody(template.bodyTemplate);
    setPreviewData(null);
  }

  async function handlePreview() {
    if (!editTemplate) return;
    try {
      const res = await api.get<{ data: PreviewData }>(
        `/api/notifications/templates/${editTemplate.id}/preview`,
      );
      setPreviewData(res.data);
    } catch {
      // ignore
    }
  }

  function handleSave() {
    if (!editTemplate) return;
    updateMutation.mutate({
      id: editTemplate.id,
      subject: editSubject || undefined,
      bodyTemplate: editBody,
    });
  }

  function insertVariable(variable: string) {
    setEditBody((prev) => prev + `{{${variable}}}`);
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Notificaciones" />

      <div className="border-b border-gray-200 px-6 flex items-center gap-6">
        {([
          { key: 'logs' as TabId, label: 'Registros' },
          { key: 'templates' as TabId, label: 'Ajustes' },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-[#008080] text-[#008080]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div className="space-y-4">
            {loadingTemplates ? (
              <div className="text-center py-12 text-gray-500">
                Cargando plantillas...
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No hay plantillas configuradas. Ejecuta el seed para crear las
                plantillas por defecto.
              </div>
            ) : (
              Object.entries(grouped)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([eventTrigger, eventTemplates]) => (
                  <div
                    key={eventTrigger}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                  >
                    {/* Event header */}
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-800">
                        {EVENT_LABELS[eventTrigger] || eventTrigger}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {eventTrigger}
                      </p>
                    </div>

                    {/* Channel rows */}
                    <div className="divide-y divide-gray-100">
                      {eventTemplates.map((template) => (
                        <div
                          key={template.id}
                          className="flex items-center justify-between px-5 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                template.type === 'EMAIL'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {CHANNEL_LABELS[template.type]}
                            </span>
                            <span className="text-sm text-gray-600 truncate max-w-md">
                              {template.subject ||
                                template.bodyTemplate.slice(0, 60) + '...'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Toggle */}
                            <button
                              onClick={() => toggleMutation.mutate(template)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                template.isActive
                                  ? 'bg-primary-600'
                                  : 'bg-gray-300'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  template.isActive
                                    ? 'translate-x-6'
                                    : 'translate-x-1'
                                }`}
                              />
                            </button>
                            {/* Edit */}
                            <button
                              onClick={() => openEdit(template)}
                              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                            >
                              Editar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
            )}
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loadingLogs ? (
              <div className="text-center py-12 text-gray-500">
                Cargando historial...
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No hay notificaciones enviadas aun.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-medium text-gray-600">
                          Fecha
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">
                          Evento
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">
                          Canal
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">
                          Destinatario
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              year: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="px-4 py-3 text-gray-800">
                            {EVENT_LABELS[log.eventName] || log.eventName}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                log.channel === 'EMAIL'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {CHANNEL_LABELS[log.channel]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {log.recipientEmail || log.recipientPhone || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                log.status === 'SENT'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {log.status === 'SENT' ? 'Enviada' : 'Fallida'}
                            </span>
                            {log.error && (
                              <span
                                className="ml-2 text-xs text-red-500"
                                title={log.error}
                              >
                                {log.error.slice(0, 40)}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {logsMeta && logsMeta.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                    <span className="text-sm text-gray-600">
                      Pagina {logsMeta.page} de {logsMeta.totalPages} (
                      {logsMeta.total} registros)
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                        disabled={logsPage <= 1}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Anterior
                      </button>
                      <button
                        onClick={() =>
                          setLogsPage((p) =>
                            Math.min(logsMeta.totalPages, p + 1),
                          )
                        }
                        disabled={logsPage >= logsMeta.totalPages}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editTemplate && (
        <Modal
          title={`Editar plantilla - ${CHANNEL_LABELS[editTemplate.type]}`}
          onClose={() => setEditTemplate(null)}
          size="lg"
        >
          <div className="space-y-4">
            {/* Subject (only for email) */}
            {editTemplate.type === 'EMAIL' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Asunto
                </label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="input-field"
                  placeholder="Asunto del email..."
                />
              </div>
            )}

            {/* Body */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cuerpo del mensaje
              </label>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                className="input-field min-h-[200px] font-mono text-sm"
                placeholder="Escribe el mensaje..."
              />
            </div>

            {/* Variables */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Variables disponibles
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(
                  EVENT_VARIABLES[editTemplate.eventTrigger] || []
                ).map((v) => (
                  <button
                    key={v}
                    onClick={() => insertVariable(v)}
                    className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-xs font-mono transition-colors"
                    title={`Insertar {{${v}}}`}
                  >
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            {previewData && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Vista previa
                </h4>
                {previewData.subject && (
                  <p className="text-sm text-gray-800 font-medium mb-1">
                    Asunto: {previewData.subject}
                  </p>
                )}
                <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans">
                  {previewData.body}
                </pre>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handlePreview}
                className="btn-secondary text-sm"
              >
                Vista previa
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditTemplate(null)}
                  className="btn-secondary text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="btn-primary text-sm"
                >
                  {updateMutation.isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

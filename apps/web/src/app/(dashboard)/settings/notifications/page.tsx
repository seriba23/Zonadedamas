'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
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

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [editTemplate, setEditTemplate] = useState<NotificationTemplate | null>(
    null,
  );
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);

  // Fetch templates
  const { data: templatesRes, isLoading: loadingTemplates } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: () =>
      api.get<{ data: NotificationTemplate[] }>(
        '/api/notifications/templates',
      ),
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
  // OJO: el `id` va SOLO en la URL, no en el body. El backend valida el body con
  // UpdateTemplateDto y rechaza (forbidNonWhitelisted) cualquier campo extra como
  // `id`, lo que hacía que el guardado fallara silenciosamente.
  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: {
      id: string;
      subject?: string;
      bodyTemplate?: string;
    }) => api.put(`/api/notifications/templates/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
      setEditTemplate(null);
    },
    onError: (err: any) => {
      alert(err?.message || 'No se pudo guardar la plantilla');
    },
  });

  const templates = templatesRes?.data || [];

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
      <div className="border-b border-gray-200 px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Notificaciones</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Activa o desactiva las notificaciones automáticas y edita sus mensajes.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-6">
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

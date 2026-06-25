// ============================================================
// ARCHIVO: apps/web/src/app/platform/notifications/page.tsx
// RUTA EN EL NAVEGADOR: /platform/notifications
//
// Página de REGISTROS DE NOTIFICACIONES del Super Admin.
// Muestra el historial global de todas las notificaciones
// enviadas por TODOS los negocios de la plataforma.
//
// ¿QUÉ SON LOS NOTIFICATION LOGS?
// Cada vez que el sistema envía un email o WhatsApp a un cliente
// (ej: "Tu cita fue creada"), se guarda un registro en la base
// de datos con: quién lo recibió, qué evento lo disparó,
// por qué canal se envió y si fue exitoso o falló.
//
// ¿QUÉ MUESTRA?
// - Filtros de estado: Todos / Enviadas / Fallidas (botones pill)
// - Tabla paginada con los registros:
//   Fecha, Negocio, Evento, Canal (Email/WhatsApp), Destinatario, Estado
// - Si el envío falló, muestra el mensaje de error truncado
//
// ¿CÓMO OBTIENE LOS DATOS?
// Usa useQuery de React Query → GET /api/platform/notification-logs
// El queryKey incluye el filtro y la página para que React Query
// vuelva a pedir los datos automáticamente cuando cambian.
// ============================================================

// 'use client': usa hooks de React y React Query → navegador.
'use client';

// useState: para el filtro de estado y la página actual.
import { useState } from 'react';

// useQuery: hook de React Query para leer y cachear datos.
import { useQuery } from '@tanstack/react-query';

// platformApi: cliente HTTP autenticado del Super Admin.
import { platformApi } from '@/lib/platform-auth';

// ─── TIPOS ───────────────────────────────────────────────

// NotificationLog: forma de cada registro de notificación.
interface NotificationLog {
  id: string;
  // channel: canal por el que se envió la notificación.
  // 'EMAIL' | 'WHATSAPP' = solo esos dos valores posibles (tipo unión).
  channel: 'EMAIL' | 'WHATSAPP';
  eventName: string;              // Nombre del evento (ej: 'appointment.created').
  recipientEmail: string | null;  // Email del destinatario (si fue por email).
  recipientPhone: string | null;  // Teléfono (si fue por WhatsApp).
  subject: string | null;         // Asunto del email (null si fue WhatsApp).
  // status: resultado del envío.
  status: 'SENT' | 'FAILED';     // Solo dos posibles valores.
  error: string | null;           // Mensaje de error si falló; null si tuvo éxito.
  createdAt: string;              // Timestamp de cuando se intentó enviar.
  tenant: { id: string; name: string; slug: string } | null; // Negocio asociado.
}

// ListResponse: forma de la respuesta completa de la API.
interface ListResponse {
  data: NotificationLog[]; // Arreglo de logs de la página actual.
  meta: { total: number; page: number; perPage: number; totalPages: number };
}

// EVENT_LABELS: traduce nombres técnicos de eventos a español legible.
// Uso: EVENT_LABELS['appointment.created'] → 'Cita creada'
const EVENT_LABELS: Record<string, string> = {
  'appointment.created': 'Cita creada',
  'appointment.confirmed': 'Cita confirmada',
  'appointment.rescheduled': 'Cita reagendada',
  'appointment.cancelled': 'Cita cancelada',
  'appointment.completed': 'Cita completada',
  'payment.completed': 'Pago completado',
};

// CHANNEL_LABELS: traduce el canal a texto legible.
const CHANNEL_LABELS: Record<string, string> = { EMAIL: 'Email', WHATSAPP: 'WhatsApp' };

// STATUS_FILTERS: define los botones de filtro de estado.
// Cada objeto tiene "value" (el valor que se envía a la API) y "label" (texto del botón).
const STATUS_FILTERS = [
  { value: '', label: 'Todos' },        // '' = sin filtro (muestra todos)
  { value: 'SENT', label: 'Enviadas' },
  { value: 'FAILED', label: 'Fallidas' },
];

// Componente principal de la página de Notificaciones.
export default function PlatformNotificationsPage() {
  // statusFilter: valor seleccionado en los botones de filtro.
  // '' = mostrar todos los estados.
  const [statusFilter, setStatusFilter] = useState('');

  // page: número de página actual.
  const [page, setPage] = useState(1);

  // ── LECTURA DE DATOS ──────────────────────────────────
  // useQuery pide los datos y los cachea.
  // queryKey: ['platform-notification-logs', statusFilter, page]
  // React Query re-ejecuta queryFn automáticamente cada vez que
  // cambia algún elemento del queryKey.
  const { data, isLoading } = useQuery({
    queryKey: ['platform-notification-logs', statusFilter, page],
    queryFn: () => {
      // Construye los parámetros de la URL de consulta.
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('perPage', '20');
      // Solo agrega el filtro de estado si tiene valor.
      if (statusFilter) params.set('status', statusFilter);
      // Devuelve la promesa de la petición GET.
      return platformApi.get<ListResponse>(`/api/platform/notification-logs?${params.toString()}`);
    },
  });

  // logs: el arreglo de registros de la respuesta.
  // "data?.data || []": si data es undefined (aún cargando), usa [].
  // El operador "?." (encadenamiento opcional) evita el error si data es undefined.
  const logs = data?.data || [];

  // meta: los metadatos de paginación.
  // "data?.meta": si data es undefined, meta será undefined también.
  const meta = data?.meta;

  // ── RENDERIZADO ──────────────────────────────────────────
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Registros de notificaciones</h1>
      <p className="text-sm text-gray-500 mb-5">Historial global de notificaciones enviadas por todos los negocios.</p>

      {/* Filtros */}
      {/* Botones "pill" (pastilla) para filtrar por estado. */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* .map() genera un botón por cada filtro definido en STATUS_FILTERS.
            "f" = objeto de filtro actual {value, label}. */}
        {STATUS_FILTERS.map((f) => {
          // active: true si este botón corresponde al filtro seleccionado actualmente.
          const active = statusFilter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => {
                // Al hacer clic, actualiza el filtro Y vuelve a la página 1.
                // Sin esto, podría quedar en una página que no existe para el nuevo filtro.
                setStatusFilter(f.value);
                setPage(1);
              }}
              // Clases dinámicas: teal si activo, blanco con borde si inactivo.
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active ? 'bg-[#008080] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Contenedor de la tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Condicional: cargando → mensaje, vacío → mensaje, con datos → tabla. */}
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No hay registros de notificaciones.</div>
        ) : (
          // Scroll horizontal en pantallas pequeñas.
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              {/* Cabecera de la tabla */}
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Negocio</th>
                  <th className="px-4 py-3 font-medium">Evento</th>
                  <th className="px-4 py-3 font-medium">Canal</th>
                  <th className="px-4 py-3 font-medium">Destinatario</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              {/* Cuerpo: divide-y agrega líneas entre filas. */}
              <tbody className="divide-y divide-gray-100">
                {/* .map() genera una fila por cada log. "log" = log actual. */}
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    {/* Fecha y hora del envío. toLocaleString formatea en español.
                        'whitespace-nowrap' evita que la fecha se parta en dos líneas. */}
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('es', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </td>

                    {/* Nombre del negocio.
                        log.tenant?.name: usa "?." para no explotar si tenant es null.
                        "|| '—'": muestra un guion si no hay negocio asociado. */}
                    <td className="px-4 py-3 text-gray-800">{log.tenant?.name || '—'}</td>

                    {/* Nombre del evento en español.
                        EVENT_LABELS[log.eventName]: busca la traducción.
                        "|| log.eventName": si no hay traducción, muestra el código original. */}
                    <td className="px-4 py-3 text-gray-700">{EVENT_LABELS[log.eventName] || log.eventName}</td>

                    {/* Badge de canal: azul para EMAIL, verde para WHATSAPP. */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        log.channel === 'EMAIL' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {CHANNEL_LABELS[log.channel]}
                      </span>
                    </td>

                    {/* Destinatario: email o teléfono según el canal.
                        "||" encadenado: si recipientEmail es null/vacío, intenta recipientPhone.
                        Si ambos son null, muestra '—'. */}
                    <td className="px-4 py-3 text-gray-600">{log.recipientEmail || log.recipientPhone || '—'}</td>

                    {/* Estado del envío: verde si enviada, rojo si falló. */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        log.status === 'SENT' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {log.status === 'SENT' ? 'Enviada' : 'Fallida'}
                      </span>
                      {/* Si hay mensaje de error, se muestra truncado a 30 caracteres.
                          "title={log.error}": al pasar el mouse aparece el mensaje completo.
                          .slice(0, 30): primeros 30 caracteres del string de error. */}
                      {log.error && (
                        <span className="ml-2 text-xs text-red-500" title={log.error}>
                          {log.error.slice(0, 30)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación: solo si hay más de una página.
            "meta && meta.totalPages > 1": ambas condiciones deben ser verdaderas. */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <span className="text-sm text-gray-500">{meta.total} registros</span>
            <div className="flex gap-2">
              {/* Anterior: no puede ir por debajo de la página 1. */}
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50">Anterior</button>
              <span className="px-3 py-1 text-sm text-gray-600">{page} / {meta.totalPages}</span>
              {/* Siguiente: no puede superar el total de páginas. */}
              <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50">Siguiente</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

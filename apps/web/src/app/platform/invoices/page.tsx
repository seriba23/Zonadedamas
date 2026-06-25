// ============================================================
// ARCHIVO: apps/web/src/app/platform/invoices/page.tsx
// RUTA EN EL NAVEGADOR: /platform/invoices
//
// Página de gestión de FACTURAS de la plataforma Siliba.
// Muestra todas las facturas generadas a los negocios (tenants)
// por su suscripción mensual al servicio.
//
// ¿QUÉ MUESTRA?
// - Filtro de estado (Pendiente, Pagada, Vencida, Anulada)
// - Tabla con todas las facturas paginadas (20 por página)
// - Acciones por fila: marcar como Pagada o Vencida
// - Paginación con botones Anterior/Siguiente
//
// ¿QUÉ HACE?
// - GET  /api/platform/invoices?page=&perPage=&status= → listar
// - POST /api/platform/invoices/:id/mark-paid          → marcar pagada
// - POST /api/platform/invoices/:id/mark-overdue       → marcar vencida
//
// CONCEPTOS CLAVE:
// - useCallback: memoriza la función fetchInvoices para que no
//   se recree en cada render (optimización de rendimiento).
// - La función se recrea SOLO cuando cambian page o filterStatus.
// - Paginación manual con useState para la página actual.
// ============================================================

// 'use client': usa hooks de React → requiere el navegador.
'use client';

// useState: para los estados de la lista, carga, filtros y página.
// useEffect: para llamar a fetchInvoices cuando cambian los filtros.
// useCallback: para memorizar la función de carga (evita recreaciones innecesarias).
import { useState, useEffect, useCallback } from 'react';

// platformApi: cliente HTTP del Super Admin con token JWT automático.
import { platformApi } from '@/lib/platform-auth';

// ─── TIPOS ───────────────────────────────────────────────

// Invoice: forma de cada factura que devuelve la API.
interface Invoice {
  id: string;              // ID único de la factura.
  invoiceNumber: string;   // Número legible (ej: "INV-2024-001").
  amountUsd: string;       // Monto en USD (viene como string desde la API).
  status: string;          // Estado: PENDING, PAID, OVERDUE, VOID.
  periodStart: string;     // Inicio del período facturado (ISO string).
  periodEnd: string;       // Fin del período facturado.
  dueDate: string;         // Fecha de vencimiento.
  paidAt: string | null;   // Fecha de pago efectivo, o null si aún no pagó.
  tenant: { id: string; name: string; slug: string }; // Negocio al que pertenece.
}

// Meta: metadatos de paginación que devuelve la API.
interface Meta {
  total: number;      // Total de facturas que coinciden con el filtro.
  page: number;       // Página actual.
  perPage: number;    // Ítems por página.
  totalPages: number; // Número total de páginas.
}

// STATUS_BADGES: mapea código de estado → clases CSS de color para el badge.
const STATUS_BADGES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',  // Ámbar = pendiente de pago.
  PAID: 'bg-green-100 text-green-700',     // Verde = factura pagada.
  OVERDUE: 'bg-red-100 text-red-700',      // Rojo = factura vencida sin pagar.
  VOID: 'bg-gray-100 text-gray-700',       // Gris = factura anulada.
};

// Componente principal de la página de Facturas.
export default function InvoicesPage() {
  // invoices: la lista de facturas de la página actual.
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // meta: datos de paginación (total, páginas, etc.). null = sin datos todavía.
  const [meta, setMeta] = useState<Meta | null>(null);

  // loading: true mientras se cargan las facturas (muestra el spinner de tabla).
  const [loading, setLoading] = useState(true);

  // actionLoading: true mientras se ejecuta una acción (mark-paid/mark-overdue).
  // Desactiva TODOS los botones de acción para evitar clics dobles.
  const [actionLoading, setActionLoading] = useState(false);

  // filterStatus: filtro de estado seleccionado. '' = mostrar todos los estados.
  const [filterStatus, setFilterStatus] = useState('');

  // page: número de la página actual (empieza en 1).
  const [page, setPage] = useState(1);

  // ── FUNCIÓN DE CARGA ──────────────────────────────────
  // useCallback memoriza la función para no recrearla en cada render.
  // Solo se recrea cuando cambian "page" o "filterStatus" (las dependencias).
  // Esto es importante porque fetchInvoices se usa como dependencia de useEffect.
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      // URLSearchParams: construye la query string (?page=1&perPage=20...) de forma segura.
      const params = new URLSearchParams();
      // String(page): convierte el número a string para el parámetro.
      params.set('page', String(page));
      params.set('perPage', '20');
      // Solo agrega el filtro si tiene valor (cadena no vacía).
      if (filterStatus) params.set('status', filterStatus);

      // Petición GET con los parámetros construidos.
      const res = await platformApi.get<{ data: Invoice[]; meta: Meta }>(
        `/api/platform/invoices?${params.toString()}`,
      );
      // Guarda los datos y metadatos de paginación en el estado.
      setInvoices(res.data);
      setMeta(res.meta);
    } catch (err) {
      console.error(err);
    } finally {
      // Siempre desactiva el spinner, tanto en éxito como en error.
      setLoading(false);
    }
  }, [page, filterStatus]); // Se recrea SOLO si cambia page o filterStatus.

  // Ejecuta fetchInvoices cuando cambia (la referencia de) la función.
  // Como useCallback la estabiliza, esto solo se dispara cuando
  // page o filterStatus cambian.
  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // Cuando el usuario cambia el filtro de estado, vuelve a la página 1.
  // Si no hiciéramos esto, podría quedar en una página 5 con 0 resultados.
  useEffect(() => { setPage(1); }, [filterStatus]);

  // ── FUNCIÓN DE ACCIÓN ────────────────────────────────
  // Maneja las acciones "mark-paid" y "mark-overdue" sobre una factura.
  // invoiceId: ID de la factura a modificar.
  // action: string literal que indica la acción ('mark-paid' | 'mark-overdue').
  async function handleAction(invoiceId: string, action: 'mark-paid' | 'mark-overdue') {
    setActionLoading(true); // Desactiva los botones mientras procesa.
    try {
      // POST al endpoint de la acción. No envía body.
      await platformApi.post(`/api/platform/invoices/${invoiceId}/${action}`);
      // Recarga la lista para reflejar el nuevo estado.
      await fetchInvoices();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false); // Reactiva los botones.
    }
  }

  // ── RENDERIZADO ──────────────────────────────────────────
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Facturas</h1>

      {/* Filters */}
      {/* Barra de filtros: selector de estado de factura. */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3">
        {/* <select>: menú desplegable nativo del navegador.
            value={filterStatus}: valor controlado desde el estado.
            onChange: actualiza filterStatus (el useEffect de arriba
            detectará el cambio y reiniciará la página a 1). */}
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">Todos los estados</option>  {/* '' = sin filtro */}
          <option value="PENDING">Pendiente</option>
          <option value="PAID">Pagada</option>
          <option value="OVERDUE">Vencida</option>
          <option value="VOID">Anulada</option>
        </select>
      </div>

      {/* Table */}
      {/* Tabla de facturas con scroll horizontal en pantallas pequeñas. */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* Cabecera de la tabla con etiquetas de columna. */}
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
              {/* Renderizado condicional del cuerpo de la tabla:
                  1. Cargando → fila con mensaje en toda la tabla (colSpan=7 = 7 columnas)
                  2. Sin resultados → fila con mensaje vacío
                  3. Con datos → una fila por factura */}
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">Cargando...</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">No se encontraron facturas</td></tr>
              ) : (
                // .map() genera una <tr> por cada factura. "inv" = factura actual.
                invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
                    {/* Número de factura */}
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{inv.invoiceNumber}</td>

                    {/* Nombre y slug del negocio */}
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{inv.tenant.name}</p>
                      <p className="text-xs text-gray-500">{inv.tenant.slug}</p>
                    </td>

                    {/* Monto: Number() convierte el string a número, .toFixed(2) = 2 decimales. */}
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      ${Number(inv.amountUsd).toFixed(2)}
                    </td>

                    {/* Badge de estado con color dinámico según STATUS_BADGES.
                        "|| 'bg-gray-100'" = fallback si el status no está en el mapa. */}
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGES[inv.status] || 'bg-gray-100'}`}>
                        {inv.status}
                      </span>
                    </td>

                    {/* Período facturado: inicio - fin. new Date() convierte ISO a objeto Date,
                        .toLocaleDateString('es') lo formatea en español (ej: 1/3/2024). */}
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(inv.periodStart).toLocaleDateString('es')} - {new Date(inv.periodEnd).toLocaleDateString('es')}
                    </td>

                    {/* Fecha de vencimiento */}
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(inv.dueDate).toLocaleDateString('es')}
                    </td>

                    {/* Acciones: botones condicionales según el estado de la factura.
                        Solo se muestran si el estado permite esa acción. */}
                    <td className="px-4 py-3 text-right space-x-2">
                      {/* Para facturas PENDIENTES: opción de marcar Pagada o Vencida. */}
                      {inv.status === 'PENDING' && (
                        <>
                          <button onClick={() => handleAction(inv.id, 'mark-paid')}
                            disabled={actionLoading} className="text-xs text-green-600 hover:text-green-700 font-medium">Pagada</button>
                          <button onClick={() => handleAction(inv.id, 'mark-overdue')}
                            disabled={actionLoading} className="text-xs text-red-600 hover:text-red-700 font-medium">Vencida</button>
                        </>
                      )}
                      {/* Para facturas VENCIDAS: solo opción de marcar Pagada. */}
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

        {/* Paginación: solo se muestra si hay más de una página (meta?.totalPages > 1).
            El operador "&&" lo oculta si meta es null o si solo hay 1 página. */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            {/* Contador de total de facturas */}
            <p className="text-sm text-gray-500">{meta.total} facturas totales</p>
            <div className="flex gap-2">
              {/* Botón Anterior. Math.max(1, p-1): nunca baja de la página 1.
                  disabled si ya estamos en la primera página. */}
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50">Anterior</button>

              {/* Indicador de página actual / total de páginas. */}
              <span className="px-3 py-1 text-sm text-gray-600">{page} / {meta.totalPages}</span>

              {/* Botón Siguiente. Math.min(totalPages, p+1): no supera la última página.
                  disabled si ya estamos en la última página. */}
              <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50">Siguiente</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useCurrency } from '@/lib/hooks/use-currency';
import { formatTimeUtc } from '@/lib/utils'; // formatea una hora UTC a "HH:mm" legible.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Forma de cada cita próxima que recibe este componente por props.
interface UpcomingAppointment {
  id: string;
  startTime: string; // hora de inicio (texto ISO).
  endTime: string;   // hora de fin.
  status: string;    // estado de la cita (CONFIRMED, PENDING, ...).
  client: { firstName: string; lastName: string; avatarUrl?: string | null };   // datos del cliente.
  employee: { id: string; firstName: string; lastName: string; color: string; avatarUrl: string | null }; // datos del empleado.
  items: { serviceNameSnapshot: string; priceSnapshot: number }[];              // servicios de la cita.
}

// ─────────────────────────────────────────────────────────────────────────────
// statusInfo: función auxiliar que traduce un código de estado (texto en inglés
// y mayúsculas) a su info visual: etiqueta en español + clases de color + color
// del puntito. Devuelve un objeto con esos 4 datos.
// ─────────────────────────────────────────────────────────────────────────────
function statusInfo(status: string): { text: string; bg: string; textColor: string; dot: string } {
  // "map" es un diccionario: clave = estado, valor = su info visual.
  const map: Record<string, { text: string; bg: string; textColor: string; dot: string }> = {
    CONFIRMED: { text: 'Confirmada', bg: 'bg-primary-50', textColor: 'text-primary-700', dot: '#008080' },
    PENDING: { text: 'Pendiente', bg: 'bg-yellow-50', textColor: 'text-yellow-700', dot: '#eab308' },
    IN_PROGRESS: { text: 'En progreso', bg: 'bg-purple-50', textColor: 'text-purple-700', dot: '#7c3aed' },
    COMPLETED: { text: 'Completada', bg: 'bg-green-50', textColor: 'text-green-700', dot: '#059669' },
    CANCELLED: { text: 'Cancelada', bg: 'bg-red-50', textColor: 'text-red-700', dot: '#dc2626' },
    NO_SHOW: { text: 'Ausente', bg: 'bg-[var(--bg-muted)]', textColor: 'text-[var(--text-secondary)]', dot: '#94a3b8' },
  };
  // map[status] busca la entrada; si el estado no está en el diccionario, el "||"
  // devuelve un valor por defecto genérico (gris, mostrando el código tal cual).
  return map[status] || { text: status, bg: 'bg-[var(--bg-muted)]', textColor: 'text-[var(--text-secondary)]', dot: '#94a3b8' };
}

// ─────────────────────────────────────────────────────────────────────────────
// UpcomingAppointments: lista "Próximas citas" del dashboard. Recibe el arreglo
// "appointments" ya calculado por el componente padre (no pide datos él mismo).
// ─────────────────────────────────────────────────────────────────────────────
export function UpcomingAppointments({ appointments }: { appointments: UpcomingAppointment[] }) {
  const { format: formatCurrency } = useCurrency();
  return (
    <div className="card-soft p-3 md:p-5">
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h2 className="text-xs md:text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Próximas citas</h2>
        <Link href="/calendar" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
          Ver todas
        </Link>
      </div>

      {/* Ternario: si la lista está vacía, mostramos un estado vacío con icono;
          si tiene citas, la lista <ul>. */}
      {appointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-[var(--text-muted)]">
          <svg className="w-10 h-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">No hay citas próximas</p>
        </div>
      ) : (
        <ul className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
          {/* Una fila por cita. */}
          {appointments.map((apt) => {
            // totalPrice: suma de los precios de todos los servicios de la cita.
            // reduce arranca en 0 y va sumando i.priceSnapshot de cada item.
            const totalPrice = apt.items.reduce((sum, i) => sum + i.priceSnapshot, 0);
            // services: nombres de los servicios unidos con coma (".map" saca el
            // nombre de cada item y ".join(', ')" los pega: "Corte, Tinte").
            const services = apt.items.map((i) => i.serviceNameSnapshot).join(', ');
            // st: info visual del estado (texto, colores) según la función de arriba.
            const st = statusInfo(apt.status);
            // Foto del cliente (puede ser null/undefined si no tiene).
            const clientAvatar = apt.client.avatarUrl;
            // Iniciales del cliente para el avatar de respaldo.
            // firstName?.[0]: primera letra del nombre (?. evita error si es null);
            // "|| ''" usa cadena vacía si no hay letra. toUpperCase() las pone en
            // mayúscula. Ej.: "ana", "gil" -> "AG".
            const clientInitials = `${apt.client.firstName?.[0] || ''}${apt.client.lastName?.[0] || ''}`.toUpperCase();

            return (
              <li key={apt.id}> {/* key única = id de la cita. */}
              <Link
                href={`/calendar?appointmentId=${apt.id}`}
                className="grid items-center gap-x-3 gap-y-1.5 px-3 py-3 rounded-2xl border border-[var(--border)] hover:bg-[var(--bg-muted)] cursor-pointer transition-colors no-underline text-inherit"
                style={{ backgroundColor: 'var(--bg-surface)', gridTemplateColumns: 'auto auto 1fr auto' }}
              >
                {/* Hora — col 1, row-span 2, centrada vertical */}
                <div className="row-span-2 self-center text-center min-w-[42px]">
                  <p className="text-sm font-bold text-primary-600 tabular-nums leading-none">
                    {formatTimeUtc(apt.startTime)}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] tabular-nums mt-1">
                    {formatTimeUtc(apt.endTime)}
                  </p>
                </div>

                {/* Avatar — col 2, row-span 2, centrado vertical */}
                <div
                  className="row-span-2 self-center w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden"
                  style={{ backgroundColor: '#008080' }}
                >
                  {/* Si hay foto la mostramos (URL absoluta o relativa + API_URL);
                      si no, mostramos las iniciales calculadas arriba. */}
                  {clientAvatar ? (
                    <img
                      src={clientAvatar.startsWith('http') ? clientAvatar : `${API_URL}${clientAvatar}`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{clientInitials}</span>
                  )}
                </div>

                {/* Nombre — col 3, row 1 */}
                <p className="text-sm md:text-base font-bold text-[var(--text-primary)] break-words min-w-0">
                  {apt.client.firstName} {apt.client.lastName}
                </p>

                {/* Precio — col 4, row 1 */}
                <p className="text-xs md:text-sm font-bold text-[var(--text-primary)] tabular-nums whitespace-nowrap text-right">
                  {formatCurrency(totalPrice)}
                </p>

                {/* Servicio — col 3, row 2. Siempre 2 renglones de alto;
                    si el texto es mas largo se trunca con "...". */}
                <p
                  className="text-xs text-[var(--text-secondary)] min-w-0 self-start leading-snug overflow-hidden"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    minHeight: 'calc(2 * 1.375em)',
                  }}
                >
                  {services}
                </p>

                {/* Status — col 4, row 2 (esquina inferior derecha).
                    Las clases st.bg y st.textColor vienen de statusInfo y pintan
                    la "pastilla" con el color correcto según el estado. */}
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap self-start justify-self-end ${st.bg} ${st.textColor}`}>
                  {/* Puntito de color (st.dot) antes del texto del estado. */}
                  <span className="w-1 h-1 rounded-full" style={{ backgroundColor: st.dot }} />
                  {st.text}
                </span>
              </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

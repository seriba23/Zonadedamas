// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// type ReactNode = TIPO de TS que representa "cualquier cosa que React puede
// pintar": texto, números, otro componente, una lista de ellos, etc. Lo usamos
// para tipar la prop children (el contenido interno del badge).
import { type ReactNode } from 'react';
// cn = helper para combinar clases CSS.
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// PROPS del Badge (una "etiqueta/pastilla" de color con texto corto).
// ─────────────────────────────────────────────────────────────────────────────
export interface BadgeProps {
  children: ReactNode; // contenido a mostrar dentro del badge (obligatorio)
  // variant = color/estilo del badge. Solo se aceptan estos valores.
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'orange';
  size?: 'sm' | 'md'; // tamaño (pequeño o mediano)
  className?: string; // clases extra opcionales
}

// Diccionario variante -> clases Tailwind. Cada par es "fondo claro + texto del
// mismo tono" (ej. bg-success-50 fondo verde claro, text-success-700 verde oscuro).
const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-gray-100 text-gray-700',
  primary: 'bg-primary-50 text-primary-700',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
  info: 'bg-info-50 text-info-700',
  purple: 'bg-purple-50 text-purple-700',
  orange: 'bg-orange-100 text-orange-700',
};

// Diccionario tamaño -> clases (texto y padding). py-0.5 = padding vertical mínimo.
const sizeClasses: Record<NonNullable<BadgeProps['size']>, string> = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
};

// Componente Badge: pinta un <span> con forma de pastilla redondeada.
export function Badge({
  children,
  variant = 'default', // estilo por defecto: gris neutro
  size = 'sm', // tamaño por defecto: pequeño
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        // inline-flex centra verticalmente; rounded-full = forma de píldora.
        'inline-flex items-center font-medium rounded-full',
        variantClasses[variant], // color según variante
        sizeClasses[size], // tamaño elegido
        className,
      )}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AppointmentStatusBadge = ayudante que, dado el ESTADO de una cita (string),
// pinta el Badge con su texto en español y su color correctos.
// Recibe una sola prop: status. El tipo se escribe en línea: { status: string }.
// ─────────────────────────────────────────────────────────────────────────────
export function AppointmentStatusBadge({
  status,
}: {
  status: string;
}) {
  // config = tabla que traduce cada estado interno (en inglés) a su etiqueta
  // visible (en español) y su variante de color.
  const config: Record<
    string,
    { label: string; variant: BadgeProps['variant'] }
  > = {
    pending: { label: 'Pendiente', variant: 'warning' },
    confirmed: { label: 'Confirmada', variant: 'primary' },
    rescheduled: { label: 'Reagendada', variant: 'orange' },
    in_progress: { label: 'En progreso', variant: 'purple' },
    completed: { label: 'Completada', variant: 'success' },
    cancelled: { label: 'Cancelada', variant: 'danger' },
    no_show: { label: 'Ausente', variant: 'default' },
  };

  // Buscamos el estado en la tabla. Si no existe (||), usamos un valor de
  // respaldo: mostramos el string crudo con estilo gris por defecto.
  // "as BadgeProps['variant']" es un "casting": le decimos a TS qué tipo es.
  const { label, variant } = config[status] || {
    label: status,
    variant: 'default' as BadgeProps['variant'],
  };

  // Devolvemos el Badge ya configurado con el color y texto correctos.
  return <Badge variant={variant}>{label}</Badge>;
}

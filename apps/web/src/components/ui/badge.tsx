import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'orange';
  size?: 'sm' | 'md';
  className?: string;
}

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

const sizeClasses: Record<NonNullable<BadgeProps['size']>, string> = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
};

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </span>
  );
}

// Appointment status badge helper
export function AppointmentStatusBadge({
  status,
}: {
  status: string;
}) {
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
    no_show: { label: 'No-show', variant: 'default' },
  };

  const { label, variant } = config[status] || {
    label: status,
    variant: 'default' as BadgeProps['variant'],
  };

  return <Badge variant={variant}>{label}</Badge>;
}

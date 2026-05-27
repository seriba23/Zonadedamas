'use client';

import { cn } from '@/lib/utils';

interface PlusBadgeProps {
  size?: 'sm' | 'md';
  className?: string;
}

export function PlusBadge({ size = 'sm', className }: PlusBadgeProps) {
  const sizes = {
    sm: 'px-1.5 py-0.5 text-[9px] gap-0.5',
    md: 'px-2 py-1 text-[11px] gap-1',
  };
  const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-bold text-white bg-[#008080] tracking-wide',
        sizes[size],
        className,
      )}
    >
      <svg className={iconSize} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 2h14v2H5v-2z" />
      </svg>
      PLUS
    </span>
  );
}

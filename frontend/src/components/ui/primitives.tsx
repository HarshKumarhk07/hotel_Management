import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl border border-zinc-200 bg-white shadow-sm', className)}
      {...props}
    />
  );
}

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        className,
      )}
      {...props}
    />
  );
}

/** Veg / Non-Veg / Jain food-label indicator (the familiar square dot). */
export function FoodLabel({ label }: { label?: string }) {
  const color =
    label === 'NON_VEG' ? 'border-red-600' : label === 'JAIN' ? 'border-amber-500' : 'border-green-600';
  const dot =
    label === 'NON_VEG' ? 'bg-red-600' : label === 'JAIN' ? 'bg-amber-500' : 'bg-green-600';
  return (
    <span
      title={label ?? 'VEG'}
      className={cn('inline-flex h-4 w-4 items-center justify-center rounded-sm border-2', color)}
    >
      <span className={cn('h-2 w-2 rounded-full', dot)} />
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-brand', className)} />;
}

export function CenteredSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-zinc-500">
      <Spinner className="h-7 w-7" />
      {label ? <p className="text-sm">{label}</p> : null}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <p className="text-base font-semibold text-zinc-800">{title}</p>
      {description ? <p className="max-w-sm text-sm text-zinc-500">{description}</p> : null}
    </div>
  );
}

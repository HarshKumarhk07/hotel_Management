'use client';

import { useAdminKitchens } from '@/hooks/useAdminKitchens';

/** Reusable kitchen picker for admin pages that are scoped to one kitchen. */
export function KitchenSelect({
  value,
  onChange,
  allowAll,
}: {
  value: string;
  onChange: (id: string) => void;
  allowAll?: boolean;
}) {
  const { data: kitchens } = useAdminKitchens();
  return (
    <select
      className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {allowAll ? <option value="">All kitchens</option> : <option value="">Select a kitchen…</option>}
      {kitchens?.map((k) => (
        <option key={k._id} value={k._id}>
          {k.name}
        </option>
      ))}
    </select>
  );
}

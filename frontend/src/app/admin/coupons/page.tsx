'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Power, Trash2 } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, FieldError } from '@/components/ui/input';
import { Badge, Card, CenteredSpinner, EmptyState } from '@/components/ui/primitives';
import {
  useAdminCoupons,
  useCouponMutations,
  type CreateCouponInput,
} from '@/hooks/useAdminCoupons';
import { apiErrorMessage } from '@/lib/api';
import { formatINR } from '@/lib/utils';

const schema = z.object({
  code: z.string().min(3, 'Min 3 chars').regex(/^[A-Za-z0-9_-]+$/, 'Letters, numbers, - or _'),
  discountType: z.enum(['FIXED', 'PERCENT']),
  discountValue: z.coerce.number().positive('Must be > 0'),
  maxDiscount: z.coerce.number().positive().optional(),
  minOrderValue: z.coerce.number().min(0).optional(),
  usageLimit: z.coerce.number().int().positive().optional(),
  perUserLimit: z.coerce.number().int().positive().optional(),
  expiresAt: z.string().optional(),
});
type Form = z.infer<typeof schema>;

function CreateCouponDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { create } = useCouponMutations();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { discountType: 'PERCENT' } });

  const type = watch('discountType');

  const onSubmit = async (values: Form) => {
    setServerError(null);
    const payload: CreateCouponInput = {
      ...values,
      code: values.code.toUpperCase(),
      expiresAt: values.expiresAt || undefined,
    };
    try {
      await create.mutateAsync(payload);
      reset();
      onClose();
    } catch (err) {
      setServerError(apiErrorMessage(err, 'Could not create coupon'));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="New coupon">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Code" error={errors.code?.message}>
          <Input className="uppercase" placeholder="SAVE10" {...register('code')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm" {...register('discountType')}>
              <option value="PERCENT">Percentage</option>
              <option value="FIXED">Fixed amount</option>
            </select>
          </Field>
          <Field label={type === 'PERCENT' ? 'Discount %' : 'Discount ₹'} error={errors.discountValue?.message}>
            <Input type="number" step="0.01" {...register('discountValue')} />
          </Field>
        </div>
        {type === 'PERCENT' ? (
          <Field label="Max discount ₹ (cap, optional)">
            <Input type="number" step="0.01" {...register('maxDiscount')} />
          </Field>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min order value ₹">
            <Input type="number" step="0.01" defaultValue={0} {...register('minOrderValue')} />
          </Field>
          <Field label="Expires at">
            <Input type="datetime-local" {...register('expiresAt')} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Total usage limit">
            <Input type="number" placeholder="Unlimited" {...register('usageLimit')} />
          </Field>
          <Field label="Per-user limit">
            <Input type="number" defaultValue={1} {...register('perUserLimit')} />
          </Field>
        </div>
        {serverError ? <FieldError message={serverError} /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create coupon'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function CouponsInner() {
  const { data: coupons, isLoading } = useAdminCoupons();
  const { toggle, remove } = useCouponMutations();
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Coupons</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New coupon
        </Button>
      </div>

      {isLoading ? (
        <CenteredSpinner />
      ) : !coupons || coupons.length === 0 ? (
        <EmptyState title="No coupons" description="Create your first discount coupon." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {coupons.map((c) => (
            <Card key={c._id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-mono font-bold text-zinc-900">{c.code}</p>
                    <Badge className={c.isActive ? 'bg-green-100 text-green-700' : 'bg-zinc-200 text-zinc-600'}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-zinc-700">
                    {c.discountType === 'PERCENT'
                      ? `${c.discountValue}% off${c.maxDiscount ? ` (max ${formatINR(c.maxDiscount)})` : ''}`
                      : `${formatINR(c.discountValue)} off`}
                  </p>
                  <p className="text-xs text-zinc-400">
                    Min order {formatINR(c.minOrderValue)} · Used {c.usedCount}
                    {c.usageLimit ? `/${c.usageLimit}` : ''} · {c.perUserLimit}/user
                    {c.expiresAt ? ` · expires ${new Date(c.expiresAt).toLocaleDateString()}` : ''}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toggle.mutate({ id: c._id, isActive: !c.isActive })}>
                  <Power className="h-4 w-4" /> {c.isActive ? 'Deactivate' : 'Activate'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => confirm(`Delete ${c.code}?`) && remove.mutate(c._id)}>
                  <Trash2 className="h-4 w-4 text-zinc-400" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateCouponDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

export default function AdminCouponsPage() {
  return (
    <AdminShell>
      <CouponsInner />
    </AdminShell>
  );
}

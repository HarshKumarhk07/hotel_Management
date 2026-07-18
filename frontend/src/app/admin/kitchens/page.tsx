'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Plus, Power } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, FieldError } from '@/components/ui/input';
import { Badge, Card, CenteredSpinner, EmptyState } from '@/components/ui/primitives';
import {
  useAdminKitchens,
  useKitchenMutations,
  type AdminKitchen,
  type CreateKitchenInput,
} from '@/hooks/useAdminKitchens';
import { apiErrorMessage } from '@/lib/api';

const schema = z
  .object({
    name: z.string().min(2, 'Name is required'),
    contactEmail: z.string().email('Invalid email').optional().or(z.literal('')),
    serviceChargePercent: z.coerce.number().min(0).max(100).optional(),
    taxPercent: z.coerce.number().min(0).max(100).optional(),
    acceptsCOD: z.boolean().optional(),
    provisionOwner: z.boolean().optional(),
    ownerName: z.string().optional(),
    ownerEmail: z.string().optional(),
    ownerPassword: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.provisionOwner) {
      if (!data.ownerName || data.ownerName.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ownerName'],
          message: 'Owner name must be at least 2 characters',
        });
      }
      if (!data.ownerEmail || !/^\S+@\S+\.\S+$/.test(data.ownerEmail)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ownerEmail'],
          message: 'Valid owner email is required',
        });
      }
      if (!data.ownerPassword || data.ownerPassword.length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ownerPassword'],
          message: 'Password must be at least 8 characters',
        });
      } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(data.ownerPassword)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ownerPassword'],
          message: 'Password must include uppercase, lowercase, a number, and a special character.',
        });
      }
    }
  });
type Form = z.infer<typeof schema>;

function CreateKitchenDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { create } = useKitchenMutations();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { provisionOwner: true } });

  const provisionOwner = watch('provisionOwner');

  const onSubmit = async (values: Form) => {
    setServerError(null);
    const payload: CreateKitchenInput = {
      name: values.name,
      contactEmail: values.contactEmail || undefined,
      settings: {
        serviceChargePercent: values.serviceChargePercent ?? 0,
        taxPercent: values.taxPercent ?? 5,
        acceptsCOD: values.acceptsCOD ?? false,
      },
    };
    if (values.provisionOwner) {
      if (!values.ownerName || !values.ownerEmail || !values.ownerPassword) {
        setServerError('Owner name, email and password are required.');
        return;
      }
      payload.owner = {
        name: values.ownerName,
        email: values.ownerEmail,
        password: values.ownerPassword,
      };
    }
    try {
      await create.mutateAsync(payload);
      reset();
      onClose();
    } catch (err) {
      setServerError(apiErrorMessage(err, 'Could not create kitchen'));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="New kitchen">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Kitchen name" error={errors.name?.message}>
          <Input placeholder="Rooftop Grill" {...register('name')} />
        </Field>
        <Field label="Contact email" error={errors.contactEmail?.message}>
          <Input type="email" placeholder="kitchen@hotel.com" {...register('contactEmail')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Service charge %">
            <Input type="number" step="0.1" defaultValue={0} {...register('serviceChargePercent')} />
          </Field>
          <Field label="Tax %">
            <Input type="number" step="0.1" defaultValue={5} {...register('taxPercent')} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" {...register('acceptsCOD')} /> Accept cash on delivery
        </label>

        <div className="rounded-lg border bg-zinc-50 p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-800">
            <input type="checkbox" {...register('provisionOwner')} /> Create owner account
          </label>
          {provisionOwner ? (
            <div className="mt-3 space-y-3">
              <Field label="Owner name" error={errors.ownerName?.message}>
                <Input placeholder="Owner name" {...register('ownerName')} />
              </Field>
              <Field label="Owner email" error={errors.ownerEmail?.message}>
                <Input type="email" placeholder="owner@hotel.com" {...register('ownerEmail')} />
              </Field>
              <Field label="Temporary password" error={errors.ownerPassword?.message}>
                <Input type="text" placeholder="Str0ng!Pass" {...register('ownerPassword')} />
              </Field>
            </div>
          ) : null}
        </div>

        {serverError ? <FieldError message={serverError} /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create kitchen'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

const editSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  contactEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  contactPhone: z.string().optional().or(z.literal('')),
  serviceChargePercent: z.coerce.number().min(0).max(100),
  taxPercent: z.coerce.number().min(0).max(100),
  acceptsCOD: z.boolean().optional(),
  acceptsRoomBilling: z.boolean().optional(),
  open: z.string().optional().or(z.literal('')),
  close: z.string().optional().or(z.literal('')),
});
type EditForm = z.infer<typeof editSchema>;

function EditKitchenDialog({ kitchen, onClose }: { kitchen: AdminKitchen | null; onClose: () => void }) {
  const { update, setActive } = useKitchenMutations();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditForm>({ resolver: zodResolver(editSchema) });

  // Reset the form whenever a different kitchen is opened.
  useEffect(() => {
    if (kitchen) {
      reset({
        name: kitchen.name,
        contactEmail: kitchen.contactEmail ?? '',
        contactPhone: '',
        serviceChargePercent: kitchen.settings.serviceChargePercent,
        taxPercent: kitchen.settings.taxPercent,
        acceptsCOD: kitchen.settings.acceptsCOD,
        acceptsRoomBilling: kitchen.settings.acceptsRoomBilling,
        open: '',
        close: '',
      });
      setServerError(null);
    }
  }, [kitchen, reset]);

  const onSubmit = async (values: EditForm) => {
    if (!kitchen) return;
    setServerError(null);
    const input: Record<string, unknown> = {
      name: values.name,
      settings: {
        serviceChargePercent: values.serviceChargePercent,
        taxPercent: values.taxPercent,
        acceptsCOD: values.acceptsCOD ?? false,
        acceptsRoomBilling: values.acceptsRoomBilling ?? false,
      },
    };
    if (values.contactEmail) input.contactEmail = values.contactEmail;
    if (values.contactPhone) input.contactPhone = values.contactPhone;
    // Operating hours are only sent when both ends are provided (backend requires the pair).
    if (values.open && values.close) {
      input.timings = { open: values.open, close: values.close, timezone: 'Asia/Kolkata' };
    }
    try {
      await update.mutateAsync({ id: kitchen._id, input });
      onClose();
    } catch (err) {
      setServerError(apiErrorMessage(err, 'Could not update kitchen'));
    }
  };

  return (
    <Dialog open={!!kitchen} onClose={onClose} title={`Edit ${kitchen?.name ?? 'kitchen'}`}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Kitchen name" error={errors.name?.message}>
          <Input {...register('name')} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Contact email" error={errors.contactEmail?.message}>
            <Input type="email" placeholder="kitchen@hotel.com" {...register('contactEmail')} />
          </Field>
          <Field label="Contact phone" error={errors.contactPhone?.message}>
            <Input placeholder="+91…" {...register('contactPhone')} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Service charge %" error={errors.serviceChargePercent?.message}>
            <Input type="number" step="0.1" {...register('serviceChargePercent')} />
          </Field>
          <Field label="Tax %" error={errors.taxPercent?.message}>
            <Input type="number" step="0.1" {...register('taxPercent')} />
          </Field>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" {...register('acceptsCOD')} /> Accept cash on delivery
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" {...register('acceptsRoomBilling')} /> Accept room billing
          </label>
        </div>

        <div className="rounded-lg border bg-zinc-50 p-3">
          <p className="mb-2 text-sm font-medium text-zinc-800">Operating hours (optional)</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Opens">
              <Input type="time" {...register('open')} />
            </Field>
            <Field label="Closes">
              <Input type="time" {...register('close')} />
            </Field>
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">Leave blank to keep the current schedule.</p>
        </div>

        {serverError ? <FieldError message={serverError} /> : null}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (kitchen) setActive.mutate({ id: kitchen._id, active: !kitchen.isActive });
            }}
          >
            <Power className="h-4 w-4" />
            {kitchen?.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

function KitchensInner() {
  const { data: kitchens, isLoading } = useAdminKitchens();
  const { setActive } = useKitchenMutations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminKitchen | null>(null);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Kitchens</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New kitchen
        </Button>
      </div>

      {isLoading ? (
        <CenteredSpinner />
      ) : !kitchens || kitchens.length === 0 ? (
        <EmptyState title="No kitchens yet" description="Create your first kitchen to get started." />
      ) : (
        <div className="space-y-3">
          {kitchens.map((k) => (
            <Card key={k._id} className="flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-zinc-900">{k.name}</p>
                  <Badge className={k.isActive ? 'bg-green-100 text-green-700' : 'bg-zinc-200 text-zinc-600'}>
                    {k.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <p className="text-xs text-zinc-500">
                  {k.owner ? `Owner: ${k.owner.name} · ${k.owner.email}` : 'No owner assigned'}
                </p>
                <p className="text-xs text-zinc-400">
                  Service {k.settings.serviceChargePercent}% · Tax {k.settings.taxPercent}% ·{' '}
                  {k.settings.acceptsCOD ? 'COD on' : 'COD off'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(k)}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActive.mutate({ id: k._id, active: !k.isActive })}
                >
                  <Power className="h-4 w-4" />
                  {k.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateKitchenDialog open={open} onClose={() => setOpen(false)} />
      <EditKitchenDialog kitchen={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

export default function AdminKitchensPage() {
  return (
    <AdminShell>
      <KitchensInner />
    </AdminShell>
  );
}

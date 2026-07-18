'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { apiErrorMessage } from '@/lib/api';
import type { AvailabilityWindow, Category, MenuItem } from '@/hooks/useAdminMenu';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export interface ItemFormValues {
  name: string;
  description?: string;
  price: number;
  taxPercent: number;
  prepTimeMinutes: number;
  foodLabel: 'VEG' | 'NON_VEG' | 'JAIN';
  category: string;
  isFeatured: boolean;
  isRecommended: boolean;
  availability: { scheduled: boolean; timezone: string; windows: AvailabilityWindow[] };
  imageFile?: File | null;
}

/** Create/edit dialog for a menu item, including scheduled-availability windows. */
export function ItemFormDialog({
  open,
  onClose,
  categories,
  initial,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  initial?: MenuItem;
  onSubmit: (values: ItemFormValues) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initial?.image?.url ?? null);
  const [values, setValues] = useState<ItemFormValues>(() => ({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    price: initial?.price ?? 0,
    taxPercent: initial?.taxPercent ?? 5,
    prepTimeMinutes: initial?.prepTimeMinutes ?? 15,
    foodLabel: initial?.foodLabel ?? 'VEG',
    category: typeof initial?.category === 'object' ? initial.category._id : initial?.category ?? categories[0]?._id ?? '',
    isFeatured: initial?.isFeatured ?? false,
    isRecommended: initial?.isRecommended ?? false,
    availability: initial?.availability ?? { scheduled: false, timezone: 'Asia/Kolkata', windows: [] },
  }));

  const set = <K extends keyof ItemFormValues>(key: K, v: ItemFormValues[K]) =>
    setValues((s) => ({ ...s, [key]: v }));

  const setAvail = (patch: Partial<ItemFormValues['availability']>) =>
    setValues((s) => ({ ...s, availability: { ...s.availability, ...patch } }));

  const addWindow = () =>
    setAvail({ windows: [...values.availability.windows, { start: '07:00', end: '11:00' }] });
  const removeWindow = (i: number) =>
    setAvail({ windows: values.availability.windows.filter((_, idx) => idx !== i) });
  const updateWindow = (i: number, patch: Partial<AvailabilityWindow>) =>
    setAvail({
      windows: values.availability.windows.map((w, idx) => (idx === i ? { ...w, ...patch } : w)),
    });
  const toggleDay = (i: number, day: number) => {
    const w = values.availability.windows[i];
    const days = new Set(w.days ?? []);
    if (days.has(day)) days.delete(day);
    else days.add(day);
    updateWindow(i, { days: Array.from(days).sort() });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const submit = async () => {
    setError(null);
    if (!values.name || !values.category) {
      setError('Name and category are required.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ ...values, imageFile });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save item'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={initial ? 'Edit item' : 'New item'} widthClass="max-w-lg">
      <div className="space-y-4">
        <Field label="Name">
          <Input value={values.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Description">
          <textarea
            value={values.description}
            onChange={(e) => set('description', e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border border-zinc-300 p-2 text-sm"
          />
        </Field>
        <Field label="Item image">
          <div className="flex items-center gap-3">
            {imagePreview ? (
              <div className="relative h-16 w-16 overflow-hidden rounded-lg border bg-zinc-50">
                <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  className="absolute top-0 right-0 rounded-bl-lg bg-red-600 p-1 text-white hover:bg-red-700"
                  aria-label="Remove image"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-white hover:border-brand transition-colors">
                <span className="text-[10px] font-semibold text-zinc-500">Upload</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
            )}
            <span className="text-xs text-zinc-400">Select a file (JPG, PNG, WebP) to upload. Max 5MB.</span>
          </div>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Price">
            <Input type="number" value={values.price} onChange={(e) => set('price', Number(e.target.value))} />
          </Field>
          <Field label="Tax %">
            <Input type="number" value={values.taxPercent} onChange={(e) => set('taxPercent', Number(e.target.value))} />
          </Field>
          <Field label="Prep (min)">
            <Input type="number" value={values.prepTimeMinutes} onChange={(e) => set('prepTimeMinutes', Number(e.target.value))} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Food label">
            <select
              className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm"
              value={values.foodLabel}
              onChange={(e) => set('foodLabel', e.target.value as ItemFormValues['foodLabel'])}
            >
              <option value="VEG">Veg</option>
              <option value="NON_VEG">Non-veg</option>
              <option value="JAIN">Jain</option>
            </select>
          </Field>
          <Field label="Category">
            <select
              className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm"
              value={values.category}
              onChange={(e) => set('category', e.target.value)}
            >
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={values.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} /> Featured
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={values.isRecommended} onChange={(e) => set('isRecommended', e.target.checked)} /> Recommended
          </label>
        </div>

        {/* Scheduled availability */}
        <div className="rounded-lg border bg-zinc-50 p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-800">
            <input
              type="checkbox"
              checked={values.availability.scheduled}
              onChange={(e) => setAvail({ scheduled: e.target.checked })}
            />{' '}
            Scheduled availability (auto-hide outside windows)
          </label>
          {values.availability.scheduled ? (
            <div className="mt-3 space-y-3">
              {values.availability.windows.map((w, i) => (
                <div key={i} className="rounded-lg border bg-white p-2">
                  <div className="flex items-center gap-2">
                    <Input type="time" value={w.start} onChange={(e) => updateWindow(i, { start: e.target.value })} />
                    <span className="text-zinc-400">–</span>
                    <Input type="time" value={w.end} onChange={(e) => updateWindow(i, { end: e.target.value })} />
                    <button onClick={() => removeWindow(i)} aria-label="Remove">
                      <Trash2 className="h-4 w-4 text-zinc-400" />
                    </button>
                  </div>
                  <div className="mt-2 flex gap-1">
                    {DAYS.map((d, idx) => (
                      <button
                        key={idx}
                        onClick={() => toggleDay(i, idx)}
                        className={`h-7 w-7 rounded text-xs font-semibold ${
                          (w.days ?? []).includes(idx) ? 'bg-brand text-white' : 'bg-zinc-100 text-zinc-500'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-400">No days selected = every day</p>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addWindow}>
                <Plus className="h-4 w-4" /> Add window
              </Button>
            </div>
          ) : null}
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save item'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

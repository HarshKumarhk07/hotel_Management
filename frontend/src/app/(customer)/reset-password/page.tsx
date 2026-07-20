'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthShell } from '@/components/auth/AuthShell';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, FieldError } from '@/components/ui/input';
import { api, apiErrorMessage } from '@/lib/api';

const schema = z.object({
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/, 'Add upper, lower, number & symbol'),
});
type Form = z.infer<typeof schema>;

function ResetInner() {
  const token = useSearchParams().get('token') ?? '';
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Form) => {
    setServerError(null);
    try {
      await api.post('/auth/reset-password', { token, password: values.password });
      setDone(true);
    } catch (err) {
      setServerError(apiErrorMessage(err, 'This link is invalid or has expired.'));
    }
  };

  if (done) {
    return (
      <div className="space-y-4 py-4 text-center">
        <p className="text-sm text-zinc-600">Your password has been updated.</p>
        <Link href="/login" className="font-semibold text-brand">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label="New password" error={errors.password?.message}>
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="••••••••"
            className="pr-10"
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 focus:outline-none"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </Field>
      {serverError ? <FieldError message={serverError} /> : null}
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || !token}>
        {isSubmitting ? 'Updating…' : 'Update password'}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Set a new password">
      <Suspense fallback={null}>
        <ResetInner />
      </Suspense>
    </AuthShell>
  );
}

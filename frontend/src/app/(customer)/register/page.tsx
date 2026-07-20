'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MailCheck, Eye, EyeOff } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { Button } from '@/components/ui/button';
import { Field, Input, FieldError } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { apiErrorMessage } from '@/lib/api';

const schema = z.object({
  name: z.string().min(2, 'Tell us your name'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().optional(),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/, 'Add upper, lower, number & symbol'),
});
type Form = z.infer<typeof schema>;

export default function RegisterPage() {
  const { register: signup } = useAuth();
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Form) => {
    setServerError(null);
    try {
      await signup(values);
      setDone(true);
    } catch (err) {
      setServerError(apiErrorMessage(err, 'Could not create your account'));
    }
  };

  if (done) {
    return (
      <AuthShell title="Check your email">
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600">
            <MailCheck className="h-8 w-8" />
          </div>
          <p className="text-sm text-zinc-600">
            We sent a verification link to <strong>{getValues('email')}</strong>. Verify your email,
            then sign in.
          </p>
          <Link href="/login" className="font-semibold text-brand">
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account" subtitle="Order food to your room in a few taps.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Full name" error={errors.name?.message}>
          <Input autoComplete="name" placeholder="Jane Guest" {...register('name')} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} />
        </Field>
        <Field label="Phone (optional)" error={errors.phone?.message}>
          <Input type="tel" autoComplete="tel" placeholder="+91…" {...register('phone')} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
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

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create account'}
        </Button>

        <p className="text-center text-sm text-zinc-500">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-brand">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

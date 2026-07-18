'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { Button } from '@/components/ui/button';
import { Field, Input, FieldError } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { api, apiErrorMessage } from '@/lib/api';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
  secretCode: z.string().optional(),
});
type Form = z.infer<typeof schema>;

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next');
  const { login, loginWithGoogle } = useAuth();
  
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showSecretCode, setShowSecretCode] = useState(false);
  const [requiresSecret, setRequiresSecret] = useState(false);
  const [isCheckingRole, setIsCheckingRole] = useState(false);
  // Track whether a role check has already been performed for the current email
  const [roleChecked, setRoleChecked] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const checkEmailRole = async (emailVal: string): Promise<boolean> => {
    if (!emailVal || !emailVal.includes('@')) return false;
    setIsCheckingRole(true);
    try {
      const res = await api.get<{ data: { requiresSecretCode: boolean } }>('/auth/check-role', {
        params: { email: emailVal },
      });
      const needs = res.data.data.requiresSecretCode;
      setRequiresSecret(needs);
      setRoleChecked(true);
      return needs;
    } catch {
      setRequiresSecret(false);
      setRoleChecked(true);
      return false;
    } finally {
      setIsCheckingRole(false);
    }
  };

  const onSubmit = async (values: Form) => {
    setServerError(null);

    // If onBlur never fired (e.g. autofill / password manager), run the check
    // now before attempting login. If a secret code is needed but not yet
    // provided, surface the box and let the user fill it in then re-submit.
    if (!roleChecked) {
      const needs = await checkEmailRole(values.email);
      if (needs && !values.secretCode) return; // box is now visible
    }

    try {
      const user = await login(values.email, values.password, values.secretCode);
      
      // Auto-route based on logged-in user role
      if (user.role === 'SUPER_ADMIN') {
        router.replace('/admin');
      } else if (user.role === 'KITCHEN_OWNER') {
        router.replace('/kitchen');
      } else if (user.role === 'VALET_MANAGER') {
        router.replace('/valet');
      } else {
        // Guest/customer role
        router.replace(next || '/');
      }
    } catch (err) {
      setServerError(apiErrorMessage(err, 'Could not sign in'));
    }
  };

  const onGoogle = async (idToken: string) => {
    setServerError(null);
    try {
      const user = await loginWithGoogle(idToken);
      if (user.role === 'SUPER_ADMIN') {
        router.replace('/admin');
      } else if (user.role === 'KITCHEN_OWNER') {
        router.replace('/kitchen');
      } else if (user.role === 'VALET_MANAGER') {
        router.replace('/valet');
      } else {
        router.replace(next || '/');
      }
    } catch (err) {
      setServerError(apiErrorMessage(err, 'Google sign-in failed'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label="Email" error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          {...register('email', {
            onBlur: (e) => {
              setRoleChecked(false); // reset if email changes
              checkEmailRole(e.target.value);
            },
          })}
        />
      </Field>
      <Field label="Password" error={errors.password?.message}>
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
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

      {/* Secret Access Code Box (shown for admin / kitchen owner accounts) */}
      {requiresSecret && (
        <div className="rounded-2xl border border-[#D4AF37]/30 bg-[#FAF8F0] p-4 space-y-2 animate-fade-in">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
            <KeyRound className="h-4 w-4" />
            Privileged Staff Verification Required
          </div>
          <p className="text-[11px] text-[#666666]">This email is mapped to an administrative staff account. Please enter your secondary access passcode.</p>
          <Field label="Staff Access Code" error={errors.secretCode?.message}>
            <div className="relative">
              <Input
                type={showSecretCode ? 'text' : 'password'}
                placeholder="Staff key passcode"
                autoFocus
                className="bg-white border-[#D4AF37]/20 focus:border-[#D4AF37]"
                {...register('secretCode')}
              />
              <button
                type="button"
                onClick={() => setShowSecretCode((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-[#D4AF37] focus:outline-none"
              >
                {showSecretCode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </Field>
        </div>
      )}

      {serverError ? <FieldError message={serverError} /> : null}

      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-xs font-medium text-brand">
          Forgot password?
        </Link>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || isCheckingRole}>
        {isCheckingRole ? 'Checking…' : isSubmitting ? 'Signing in…' : requiresSecret ? 'Verify & Sign in' : 'Sign in'}
      </Button>

      <div className="py-2"><GoogleButton onToken={onGoogle} /></div>

      <p className="text-center text-sm text-zinc-500">
        New here?{' '}
        <Link href="/register" className="font-semibold text-brand">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your hotel account">
      <Suspense fallback={<CenteredSpinner />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}

function CenteredSpinner() {
  return (
    <div className="flex h-32 items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
    </div>
  );
}

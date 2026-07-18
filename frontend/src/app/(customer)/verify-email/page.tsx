'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { CenteredSpinner } from '@/components/ui/primitives';
import { api, apiErrorMessage } from '@/lib/api';

function VerifyInner() {
  const token = useSearchParams().get('token');
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('This verification link is missing its token.');
      return;
    }
    api
      .post('/auth/verify-email', { token })
      .then(() => setState('ok'))
      .catch((err) => {
        setState('error');
        setMessage(apiErrorMessage(err, 'This link is invalid or has expired.'));
      });
  }, [token]);

  if (state === 'loading') return <CenteredSpinner label="Verifying your email…" />;

  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      {state === 'ok' ? (
        <>
          <CheckCircle2 className="h-14 w-14 text-green-600" />
          <p className="text-sm text-zinc-600">Your email is verified. You can sign in now.</p>
        </>
      ) : (
        <>
          <XCircle className="h-14 w-14 text-red-600" />
          <p className="text-sm text-zinc-600">{message}</p>
        </>
      )}
      <Link href="/login" className="font-semibold text-brand">
        Go to sign in
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthShell title="Email verification">
      <Suspense fallback={<CenteredSpinner />}>
        <VerifyInner />
      </Suspense>
    </AuthShell>
  );
}

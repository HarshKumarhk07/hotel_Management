'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CenteredSpinner } from '@/components/ui/primitives';

export default function AdminLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login?next=/admin');
  }, [router]);

  return <CenteredSpinner />;
}

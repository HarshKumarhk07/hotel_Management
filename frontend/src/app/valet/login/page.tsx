'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CenteredSpinner } from '@/components/ui/primitives';

export default function ValetLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login?next=/valet');
  }, [router]);

  return <CenteredSpinner />;
}

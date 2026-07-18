'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CenteredSpinner } from '@/components/ui/primitives';

export default function KitchenLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login?next=/kitchen');
  }, [router]);

  return <CenteredSpinner />;
}

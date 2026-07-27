'use client';

import { useEffect } from 'react';

/**
 * Warns the user before they lose unsaved edits via a hard navigation (tab
 * close, refresh, or typing a new URL). The browser shows its native
 * "Leave site?" prompt while `isDirty` is true. In-app <Link> navigations are
 * intentionally not blocked (the App Router has no stable API for that); the
 * paired "Unsaved changes" badge covers that case visually.
 */
export function useUnsavedChanges(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
}

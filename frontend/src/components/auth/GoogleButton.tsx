'use client';

import { useEffect, useRef } from 'react';

interface GoogleIdResponse {
  credential: string;
}
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (r: GoogleIdResponse) => void }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
        };
      };
    };
  }
}

/**
 * Renders Google Identity Services' button. On success it hands the ID token to
 * `onToken`, which the page exchanges via POST /auth/google. Renders nothing if
 * no client id is configured.
 */
export function GoogleButton({ onToken }: { onToken: (idToken: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || !ref.current) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      if (!window.google || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (r) => onToken(r.credential),
      });
      window.google.accounts.id.renderButton(ref.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
      });
    };
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, [clientId, onToken]);

  if (!clientId) return null;
  return <div ref={ref} className="flex justify-center" />;
}

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

// Module-level global references to ensure single initialization
let googleScriptPromise: Promise<void> | null = null;
let googleInitialized = false;

function loadGoogleScript(): Promise<void> {
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    if (window.google) {
      resolve();
      return;
    }

    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    document.body.appendChild(script);
  });

  return googleScriptPromise;
}

/**
 * Renders Google Identity Services' button. On success it hands the ID token to
 * `onToken`, which the page exchanges via POST /auth/google. Renders nothing if
 * no client id is configured.
 */
export function GoogleButton({ onToken }: { onToken: (idToken: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const onTokenRef = useRef(onToken);
  
  // Keep the latest callback available in ref to avoid re-running useEffect
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!clientId) return;

    let active = true;

    loadGoogleScript().then(() => {
      if (!active || !window.google || !ref.current) return;

      if (!googleInitialized) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (r) => {
            onTokenRef.current?.(r.credential);
          },
        });
        googleInitialized = true;
      }

      window.google.accounts.id.renderButton(ref.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
      });
    });

    return () => {
      active = false;
    };
  }, [clientId]);

  if (!clientId) return null;
  return <div ref={ref} className="flex justify-center" />;
}

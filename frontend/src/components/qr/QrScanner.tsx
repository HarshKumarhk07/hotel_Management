'use client';

import { useEffect, useRef, useState } from 'react';
import type { Html5Qrcode } from 'html5-qrcode';
import { AlertCircle, CheckCircle2, Loader2, Upload, X } from 'lucide-react';

type Phase = 'opening' | 'scanning' | 'detected' | 'error';

const REGION_ID = 'qr-reader-region';

/**
 * Fully release the camera. html5-qrcode's stop() can race with React removing
 * the <video> on navigation/unmount, leaving the underlying MediaStream tracks
 * live (the tab keeps showing the camera indicator). So after stop()/clear() we
 * also explicitly stop any tracks still attached to the region's video.
 */
async function teardown(instance: Html5Qrcode | null): Promise<void> {
  if (instance) {
    try {
      await instance.stop();
    } catch {
      /* already stopped / not running */
    }
    try {
      instance.clear();
    } catch {
      /* ignore */
    }
  }
  const region = typeof document !== 'undefined' ? document.getElementById(REGION_ID) : null;
  region?.querySelectorAll('video').forEach((video) => {
    const stream = video.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  });
}

/**
 * Full-screen live QR scanner backed by html5-qrcode. Prefers the rear
 * (`environment`) camera on mobile and falls back to whatever webcam exists on
 * desktop. Classifies start failures into actionable messages (permission
 * denied / no camera) and always releases the camera on close/unmount.
 */
export function QrScanner({
  onDetected,
  onClose,
  onUploadInstead,
}: {
  onDetected: (text: string) => void;
  onClose: () => void;
  onUploadInstead: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('opening');
  const [errorMsg, setErrorMsg] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        if (cancelled) return;

        const instance = new Html5Qrcode(REGION_ID, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        scannerRef.current = instance;

        await instance.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          async (decodedText: string) => {
            if (handledRef.current || !decodedText) return;
            handledRef.current = true;
            setPhase('detected');
            // Release the camera fully BEFORE navigating, so the stream can't
            // outlive this component on the next page.
            await teardown(instance);
            onDetected(decodedText);
          },
          () => undefined, // per-frame decode misses are normal — ignore
        );
        if (!cancelled) setPhase('scanning');
      } catch (err: unknown) {
        if (cancelled) return;
        const name = (err as { name?: string })?.name ?? '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
          setErrorMsg(
            'Camera access is required to scan QR codes. You can allow camera access or upload a QR image instead.',
          );
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') {
          setErrorMsg('No camera detected on this device. Please upload a QR image.');
        } else {
          setErrorMsg('Could not start the camera. Please upload a QR image instead.');
        }
        setPhase('error');
      }
    })();

    return () => {
      cancelled = true;
      void teardown(scannerRef.current);
    };
  }, [onDetected]);

  // Close on Escape for keyboard users.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan room QR code"
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950/95 p-4 text-white backdrop-blur"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Scan Room QR</h2>
        <button
          onClick={onClose}
          aria-label="Close scanner"
          className="rounded-full p-2 text-white/80 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5">
        {/* Camera surface — html5-qrcode injects the <video> here. */}
        <div
          className={`relative w-full max-w-xs overflow-hidden rounded-2xl border border-white/15 bg-black ${
            phase === 'error' ? 'hidden' : 'aspect-square'
          }`}
        >
          <div id={REGION_ID} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
          {phase === 'opening' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white/80">
              <Loader2 className="h-6 w-6 animate-spin" />
              Opening camera…
            </div>
          )}
          {phase === 'detected' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-sm font-medium">
              <CheckCircle2 className="h-8 w-8 text-green-400" />
              QR code detected
              <span className="text-white/70">Loading menu…</span>
            </div>
          )}
        </div>

        {phase === 'scanning' && (
          <p className="text-center text-sm text-white/80" aria-live="polite">
            Point your camera at the QR code
          </p>
        )}

        {phase === 'error' && (
          <div className="w-full max-w-xs space-y-4 text-center" aria-live="assertive">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-red-300">
              <AlertCircle className="h-6 w-6" />
            </div>
            <p className="text-sm text-white/90">{errorMsg}</p>
            <button
              onClick={onUploadInstead}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Upload className="h-4 w-4" /> Upload QR Image
            </button>
            <button
              onClick={onClose}
              className="text-sm font-medium text-white/70 underline-offset-2 hover:underline"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

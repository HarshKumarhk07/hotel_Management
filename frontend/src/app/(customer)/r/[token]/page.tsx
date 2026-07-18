import { redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import type { ApiSuccess, ScanResolution } from '@/lib/types';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

/**
 * QR landing route. The printed code points here (`/r/<token>`). We resolve the
 * token to a room + kitchen server-side, then forward to that kitchen's menu
 * with the room context attached — the guest never types a room number.
 */
export default async function ScanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let resolution: ScanResolution | null = null;
  let errorMessage: string | null = null;

  try {
    const res = await fetch(`${API}/rooms/resolve/${token}`, { cache: 'no-store' });
    if (res.ok) {
      const body = (await res.json()) as ApiSuccess<ScanResolution>;
      resolution = body.data;
    } else {
      const body = (await res.json()) as { error?: { message?: string } };
      errorMessage = body.error?.message ?? 'This QR code could not be read.';
    }
  } catch {
    errorMessage = 'We could not reach the server. Please try again.';
  }

  if (resolution?.kitchen) {
    const { room, kitchen } = resolution;
    redirect(`/k/${kitchen._id}?room=${room.id}&rno=${encodeURIComponent(room.roomNumber)}`);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-zinc-900">QR code not available</h1>
        <p className="text-sm text-zinc-500">{errorMessage ?? 'This code is no longer active.'}</p>
      </div>
      <Link href="/" className="text-sm font-semibold text-brand">
        Go to home
      </Link>
    </main>
  );
}

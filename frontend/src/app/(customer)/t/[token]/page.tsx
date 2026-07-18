import { redirect } from "next/navigation";
import { AlertTriangle, UtensilsCrossed } from "lucide-react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";

export default async function TableScanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let resolution = null;
  let errorMessage = null;
  try {
    const res = await fetch(`${API}/restaurant/tables/resolve/${token}`, { cache: "no-store" });
    if (res.ok) {
      const body = await res.json();
      resolution = body.data;
    } else {
      const body = await res.json();
      errorMessage = body.error?.message ?? "This QR code could not be read.";
    }
  } catch {
    errorMessage = "We could not reach the server. Please try again.";
  }
  if (resolution && resolution.status !== "OCCUPIED") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <UtensilsCrossed className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-zinc-900">Table not ready for ordering</h1>
          <p className="text-sm text-zinc-500">Table {resolution.number} is currently <strong>{resolution.status.toLowerCase()}</strong>. Please ask staff to seat you first.</p>
        </div>
        <Link href="/" className="text-sm font-semibold text-brand">Go to home</Link>
      </main>
    );
  }
  if (resolution?.kitchen) {
    const p = new URLSearchParams({ table: resolution._id, tno: resolution.number });
    if (resolution.section) p.set("section", resolution.section);
    redirect(`/k/${resolution.kitchen._id}?${p}`);
  }
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-zinc-900">Table not found</h1>
        <p className="text-sm text-zinc-500">{errorMessage ?? "This QR code is no longer active."}</p>
      </div>
      <Link href="/" className="text-sm font-semibold text-brand">Go to home</Link>
    </main>
  );
}
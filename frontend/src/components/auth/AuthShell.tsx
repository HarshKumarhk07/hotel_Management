import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen max-w-md mx-auto w-full flex-col px-6 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <Image
          src="/logo.png"
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 rounded-md object-contain"
        />
        <span className="font-bold text-zinc-900">The Page</span>
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
        {subtitle ? <p className="text-sm text-zinc-500">{subtitle}</p> : null}
      </div>
      <div className="mt-6">{children}</div>
    </main>
  );
}

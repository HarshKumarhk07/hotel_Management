import Image from 'next/image';
import { cn } from '@/lib/utils';

/** The brand logo on a clean white tile. Used across hero + auth screens. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200',
        className ?? 'h-14 w-14',
      )}
    >
      <Image
        src="/logo.png"
        alt="The Page logo"
        width={80}
        height={80}
        priority
        className="h-[80%] w-[80%] object-contain"
      />
    </div>
  );
}

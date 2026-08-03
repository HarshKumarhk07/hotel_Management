import type { Metadata, Viewport } from 'next';
import { Inter, Outfit, Playfair_Display, Manrope, Cormorant_Garamond } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-cormorant' });

if (typeof window !== 'undefined') {
  const originalPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function play() {
    return originalPlay.apply(this, arguments as any).catch((error: any) => {
      if (error && error.name === 'AbortError') {
        // Suppress "The play() request was interrupted because the media was removed from the document"
        return;
      }
      throw error;
    });
  };
}

export const metadata: Metadata = {
  title: 'The Page - Luxury Hotel & Banquets',
  description: 'Scan, browse the kitchen menu, and order food straight to your room.',
  icons: {
    icon: '/logo.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#D8B854',
  width: 'device-width',
  initialScale: 1,
};

import { Toaster } from 'sonner';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} ${playfair.variable} ${manrope.variable} ${cormorant.variable}`}>
      {/* Browser extensions (Grammarly, etc.) inject attributes onto <body>
          before hydration; suppress the resulting attribute-only mismatch. */}
      <body className="font-sans" suppressHydrationWarning>
        <Providers>{children}</Providers>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}

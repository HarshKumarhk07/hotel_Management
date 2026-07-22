import type { Metadata, Viewport } from 'next';
import { Inter, Outfit, Playfair_Display } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} ${playfair.variable}`}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

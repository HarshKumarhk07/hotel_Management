'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import NextImage from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useQrStore } from '@/stores/qr';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrScanner } from '@/components/qr/QrScanner';
import jsQR from 'jsqr';

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, status, logout } = useAuth();
  
  const scannerOpen = useQrStore((s) => s.isOpen);
  const openScanner = useQrStore((s) => s.openScanner);
  const closeScanner = useQrStore((s) => s.closeScanner);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleScrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    if (pathname === '/') {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      router.push(`/#${id}`);
    }
  };

  const handleNavClick = (path: string) => {
    setMobileMenuOpen(false);
    router.push(path);
  };

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('scan') === 'true') {
      openScanner();
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [openScanner]);

  const processDecoded = useCallback(
    (data: string) => {
      let token = data.trim();
      if (token.includes('/r/')) {
        const parts = token.split('/r/');
        token = parts[parts.length - 1].split(/[?#]/)[0];
      }
      if (!token) {
        closeScanner();
        return;
      }
      closeScanner();
      try {
        const url = new URL(token);
        if (url.origin === window.location.origin || token.startsWith('/')) {
          router.push(url.pathname + url.search);
        } else {
          router.push(`/r/${encodeURIComponent(token)}`);
        }
      } catch (e) {
        router.push(`/r/${encodeURIComponent(token)}`);
      }
    },
    [router, closeScanner],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) return;
          canvas.width = img.width;
          canvas.height = img.height;
          context.drawImage(img, 0, 0, img.width, img.height);
          const imageData = context.getImageData(0, 0, img.width, img.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });
          if (code && code.data) {
            processDecoded(code.data);
          } else {
            alert('No valid QR code found in this image.');
          }
        } catch {
          alert('Failed to process image.');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled || pathname !== '/'
            ? 'bg-black/70 backdrop-blur-md shadow-lg border-b border-white/10'
            : 'bg-black/40 backdrop-blur-md border-b border-white/10'
        }`}
      >
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20 transition-all duration-300 group-hover:bg-white/25">
              <NextImage
                src="/logo.png"
                alt="The Page Logo"
                width={40}
                height={40}
                priority
                className="h-full w-full object-contain p-1.5"
              />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-bold tracking-[0.25em] text-[#D4AF37] font-serif uppercase leading-none">
                THE PAGE
              </span>
              <span className="text-[7px] font-semibold tracking-[0.3em] text-white/60 uppercase mt-1">
                LUXURY HOTEL
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-8 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white">
            <button
              onClick={() => handleNavClick('/')}
              className={`transition-colors pb-1 border-b-2 ${
                pathname === '/' ? 'text-[#D4AF37] border-[#D4AF37]' : 'border-transparent hover:border-[#D4AF37] hover:text-[#D4AF37]'
              }`}
            >
              Home
            </button>
            <button
              onClick={() => handleNavClick('/rooms')}
              className={`transition-colors pb-1 border-b-2 ${
                pathname.startsWith('/rooms') ? 'text-[#D4AF37] border-[#D4AF37]' : 'border-transparent hover:border-[#D4AF37] hover:text-[#D4AF37]'
              }`}
            >
              Rooms
            </button>
            <button
              onClick={() => handleNavClick('/banquets')}
              className={`transition-colors pb-1 border-b-2 ${
                pathname.startsWith('/banquets') ? 'text-[#D4AF37] border-[#D4AF37]' : 'border-transparent hover:border-[#D4AF37] hover:text-[#D4AF37]'
              }`}
            >
              Banquet
            </button>
            <button
              onClick={() => handleNavClick('/restaurant/waitlist')}
              className={`transition-colors pb-1 border-b-2 ${
                pathname.startsWith('/restaurant') ? 'text-[#D4AF37] border-[#D4AF37]' : 'border-transparent hover:border-[#D4AF37] hover:text-[#D4AF37]'
              }`}
            >
              Restaurant
            </button>
            <button
              onClick={() => handleScrollToSection('amenities')}
              className="hover:text-[#D4AF37] transition-colors pb-1 border-b-2 border-transparent hover:border-[#D4AF37]"
            >
              Amenities
            </button>
            <button
              onClick={() => handleNavClick('/about')}
              className={`transition-colors pb-1 border-b-2 ${
                pathname.startsWith('/about') ? 'text-[#D4AF37] border-[#D4AF37]' : 'border-transparent hover:border-[#D4AF37] hover:text-[#D4AF37]'
              }`}
            >
              About
            </button>
          </nav>

          <nav className="hidden lg:flex items-center gap-6 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white">
            <button
              onClick={() => openScanner()}
              className="hover:text-[#D4AF37] transition-colors text-[#D4AF37] border border-[#D4AF37] px-4 py-2 rounded-full hover:bg-[#D4AF37]/15 transition-all"
            >
              Scan QR
            </button>
            {status === 'authenticated' ? (
              <>
                <Link
                  href={
                    user?.role === 'SUPER_ADMIN' || user?.role === 'KITCHEN_OWNER'
                      ? '/admin'
                      : user?.role === 'VALET_MANAGER'
                      ? '/valet/dashboard'
                      : '/orders'
                  }
                  className="hover:text-[#D4AF37] transition-colors pb-1 border-b-2 border-transparent hover:border-[#D4AF37]"
                >
                  Dashboard
                </Link>
                <button
                  onClick={() => { void logout(); }}
                  className="hover:text-red-400 text-white/70 transition-colors pb-1 border-b-2 border-transparent hover:border-red-400"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="hover:text-[#D4AF37] transition-colors pb-1 border-b-2 border-transparent hover:border-[#D4AF37]"
              >
                Login
              </Link>
            )}
          </nav>

          <div className="lg:hidden flex items-center gap-4">
            <button
              onClick={() => openScanner()}
              className="text-[#D4AF37] border border-[#D4AF37] text-[10px] font-extrabold tracking-wider uppercase px-3 py-1.5 rounded-full"
            >
              Scan QR
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-white hover:text-[#D4AF37] transition-colors p-1"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden bg-zinc-950 border-b border-white/10 px-6 py-6 space-y-4 flex flex-col text-[11px] font-extrabold uppercase tracking-[0.2em]"
            >
              <button
                onClick={() => handleNavClick('/')}
                className={`text-left ${pathname === '/' ? 'text-[#D4AF37]' : 'text-white hover:text-[#D4AF37]'}`}
              >
                Home
              </button>
              <button
                onClick={() => handleNavClick('/rooms')}
                className={`text-left ${pathname.startsWith('/rooms') ? 'text-[#D4AF37]' : 'text-white hover:text-[#D4AF37]'}`}
              >
                Rooms
              </button>
              <button
                onClick={() => handleNavClick('/banquets')}
                className={`text-left ${pathname.startsWith('/banquets') ? 'text-[#D4AF37]' : 'text-white hover:text-[#D4AF37]'}`}
              >
                Banquet
              </button>
              <button
                onClick={() => handleNavClick('/restaurant/waitlist')}
                className={`text-left ${pathname.startsWith('/restaurant') ? 'text-[#D4AF37]' : 'text-white hover:text-[#D4AF37]'}`}
              >
                Restaurant
              </button>
              <button
                onClick={() => handleScrollToSection('amenities')}
                className="text-white hover:text-[#D4AF37] text-left"
              >
                Amenities
              </button>
              <button
                onClick={() => handleNavClick('/about')}
                className={`text-left ${pathname.startsWith('/about') ? 'text-[#D4AF37]' : 'text-white hover:text-[#D4AF37]'}`}
              >
                About
              </button>
              {status === 'authenticated' ? (
                <>
                  <Link
                    href={
                      user?.role === 'SUPER_ADMIN' || user?.role === 'KITCHEN_OWNER'
                        ? '/admin'
                        : user?.role === 'VALET_MANAGER'
                        ? '/valet/dashboard'
                        : '/orders'
                    }
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-white hover:text-[#D4AF37] text-left mt-2"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      void logout();
                    }}
                    className="text-white/70 hover:text-red-400 text-left mt-2"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-white hover:text-[#D4AF37] text-left mt-2"
                >
                  Login
                </Link>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {scannerOpen && (
        <QrScanner
          onDetected={processDecoded}
          onClose={() => closeScanner()}
          onUploadInstead={() => fileInputRef.current?.click()}
        />
      )}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />
    </>
  );
}

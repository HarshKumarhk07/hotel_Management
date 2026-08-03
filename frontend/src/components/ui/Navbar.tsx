'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import NextImage from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useQrStore } from '@/stores/qr';
import { Menu, X, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrScanner } from '@/components/qr/QrScanner';
import jsQR from 'jsqr';
import { toast } from 'sonner';

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
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
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
            toast.info('No valid QR code found in this image.');
          }
        } catch {
          toast.error('Failed to process image.');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const isHome = pathname === '/';
  
  // Refined styling based on scroll state and route
  const navBgClass = scrolled 
    ? 'bg-page-black/95 backdrop-blur-md border-b border-page-ivory/5 shadow-luxury'
    : isHome 
      ? 'bg-transparent border-b border-transparent' 
      : 'bg-page-black/50 backdrop-blur-md border-b border-page-ivory/5';

  const [isLoaded, setIsLoaded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 1200); // Loads after brand text in Hero
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-1000 ease-[0.25,0.1,0.25,1] will-change-[background-color,border-color,backdrop-filter] ${navBgClass} ${isHome && !isLoaded ? 'opacity-0 translate-y-[-20px]' : 'opacity-100 translate-y-0'}`}
      >
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex flex-col items-center group relative z-10">
            <div className="mb-1 relative">
              <div className="absolute inset-0 bg-page-gold/20 blur-xl rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <NextImage src="/logo.png" alt="The Page Logo" width={40} height={40} className="object-contain relative z-10 drop-shadow-md group-hover:scale-105 transition-transform duration-700" />
            </div>
            <span className="text-sm md:text-base font-serif font-bold tracking-[0.3em] text-page-ivory uppercase leading-none group-hover:text-page-gold transition-colors duration-700 drop-shadow-sm">
              THE PAGE
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-14 text-[9px] font-medium uppercase tracking-[0.15em] text-page-ivory">
            {[
              { label: 'Home', path: '/' },
              { label: 'Rooms', path: '/rooms' },
              { label: 'Banquet', path: '/banquets' },
              { label: 'Restaurant', path: '/restaurant/waitlist' },
            ].map((link) => {
              const isActive = link.path === '/' ? pathname === '/' : pathname.startsWith(link.path);
              return (
                <button
                  key={link.label}
                  onClick={() => handleNavClick(link.path)}
                  className={`relative group py-2 transition-colors duration-500 ${isActive ? 'text-page-gold drop-shadow-md' : 'text-page-ivory/80 hover:text-white drop-shadow-sm'}`}
                >
                  {link.label}
                  <span className={`absolute left-1/2 bottom-0 h-[2px] bg-page-gold transition-all duration-500 ease-[0.25,0.1,0.25,1] will-change-[width,left] -translate-x-1/2 ${isActive ? 'w-full' : 'w-0 group-hover:w-full'}`} />
                </button>
              );
            })}

            {/* More Dropdown */}
            <div className="relative group py-2 cursor-pointer">
              <button
                className={`flex items-center gap-1 transition-colors duration-500 text-page-ivory/90 hover:text-page-gold ${
                  ['/gallery', '/about', '/contact', '/facilities'].some(p => pathname.startsWith(p)) || pathname === '/#amenities'
                    ? 'text-page-gold'
                    : ''
                }`}
              >
                More <ChevronDown className="h-3 w-3 transition-transform duration-500 group-hover:rotate-180" />
              </button>
              
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-6 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-500 will-change-[opacity,visibility] translate-y-2 group-hover:translate-y-0">
                <div className="flex flex-col bg-page-black border border-white/10 shadow-2xl min-w-[180px] py-3 rounded-b-xl overflow-hidden">
                  {[
                    { label: 'Gallery', path: '/gallery' },
                    { label: 'About', path: '/about' },
                    { label: 'Contact', path: '/contact' },
                    { label: 'Amenities', path: '#amenities', action: () => handleScrollToSection('amenities') },
                    { label: 'Facilities', path: '/facilities' },
                  ].map((sublink) => (
                    <button
                      key={sublink.label}
                      onClick={sublink.action || (() => handleNavClick(sublink.path))}
                      className={`text-left px-6 py-3 transition-colors duration-medium ${
                        pathname.startsWith(sublink.path) ? 'text-page-gold bg-page-ivory/5' : 'text-page-ivory/80 hover:text-page-gold hover:bg-page-ivory/5'
                      }`}
                    >
                      {sublink.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </nav>

          {/* Desktop Right Actions */}
          <nav className="hidden lg:flex items-center gap-8 text-[9px] font-extrabold uppercase tracking-widest text-page-ivory relative z-10">
            <button
              onClick={() => openScanner()}
              className="group relative overflow-hidden text-page-gold border border-page-gold/30 px-6 py-2.5 hover:border-page-gold transition-all duration-500 will-change-[background-color,border-color,color] rounded-sm bg-page-gold/5"
            >
              <span className="relative z-10 group-hover:text-page-black transition-colors duration-500">Scan QR</span>
              <div className="absolute inset-0 bg-page-gold translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[0.25,0.1,0.25,1]" />
            </button>
            {status === 'authenticated' ? (
              <div className="flex items-center gap-6">
                <Link
                  href={
                    user?.role === 'SUPER_ADMIN' || user?.role === 'KITCHEN_OWNER'
                      ? '/admin'
                      : user?.role === 'VALET_MANAGER'
                      ? '/valet'
                      : '/orders'
                  }
                  className="relative group py-2 hover:text-page-gold transition-colors duration-medium"
                >
                  Dashboard
                  <span className="absolute left-0 bottom-0 w-0 h-[1px] bg-page-gold transition-all duration-medium group-hover:w-full" />
                </Link>
                <button
                  onClick={() => { void logout(); }}
                  className="relative group py-2 text-page-ivory/60 hover:text-red-400 transition-colors duration-medium"
                >
                  Logout
                  <span className="absolute left-0 bottom-0 w-0 h-[1px] bg-red-400 transition-all duration-medium group-hover:w-full" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="relative group py-2 hover:text-page-gold transition-colors duration-medium"
              >
                Login
                <span className="absolute left-0 bottom-0 w-0 h-[1px] bg-page-gold transition-all duration-medium group-hover:w-full" />
              </Link>
            )}
          </nav>

          {/* Mobile Toggle */}
          <div className="lg:hidden flex items-center gap-5 relative z-20">
            <button
              onClick={() => openScanner()}
              className="text-page-gold border border-page-gold/50 text-[9px] font-extrabold tracking-widest uppercase px-4 py-2 hover:bg-page-gold hover:text-page-black transition-colors"
            >
              Scan QR
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-page-ivory hover:text-page-gold transition-colors p-1"
            >
              {mobileMenuOpen ? <X strokeWidth={1.5} className="h-7 w-7" /> : <Menu strokeWidth={1.5} className="h-7 w-7" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: '100vh' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
              className="lg:hidden fixed inset-0 top-0 bg-page-black z-10 pt-24 px-8 overflow-y-auto flex flex-col"
            >
              <div className="flex flex-col gap-6 text-[11px] font-extrabold uppercase tracking-widest">
                {[
                  { label: 'Home', path: '/' },
                  { label: 'Rooms', path: '/rooms' },
                  { label: 'Banquet', path: '/banquets' },
                  { label: 'Restaurant', path: '/restaurant/waitlist' },
                  { label: 'Menu', path: '/menu' },
                  { label: 'Gallery', path: '/gallery' },
                  { label: 'About', path: '/about' },
                  { label: 'Contact', path: '/contact' },
                  { label: 'Amenities', path: '#amenities', action: () => handleScrollToSection('amenities') },
                  { label: 'Facilities', path: '/facilities' },
                ].map((link) => (
                  <button
                    key={link.label}
                    onClick={link.action || (() => handleNavClick(link.path))}
                    className={`text-left py-2 border-b border-white/5 ${
                      (link.path === '/' ? pathname === '/' : pathname.startsWith(link.path.split('#')[0]))
                        ? 'text-page-gold'
                        : 'text-page-ivory hover:text-page-gold'
                    } transition-colors`}
                  >
                    {link.label}
                  </button>
                ))}

                <div className="pt-8 flex flex-col gap-6 border-t border-white/10">
                  {status === 'authenticated' ? (
                    <>
                      <button
                        onClick={() => handleNavClick(
                          user?.role === 'SUPER_ADMIN' || user?.role === 'KITCHEN_OWNER'
                            ? '/admin'
                            : user?.role === 'VALET_MANAGER'
                            ? '/valet'
                            : '/orders'
                        )}
                        className="text-left text-page-ivory hover:text-page-gold transition-colors"
                      >
                        Dashboard
                      </button>
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          void logout();
                        }}
                        className="text-left text-page-ivory/60 hover:text-red-400 transition-colors"
                      >
                        Logout
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleNavClick('/login')}
                      className="text-left text-page-ivory hover:text-page-gold transition-colors"
                    >
                      Login
                    </button>
                  )}
                </div>
              </div>
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

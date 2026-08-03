import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#D4AF37',
          50: '#FAF8F0',
          100: '#F5ECD0',
          500: '#D4AF37',
          600: '#B8972E',
          700: '#8A752A',
        },
        page: {
          green: '#1A2F24',
          beige: '#E8DCC4',
          cream: '#F6F4EB',
          ivory: '#FAF9F6',
          gold: '#D4AF37',
          'gold-dark': '#B8972E',
          black: '#111111',
        },
        gold: {
          DEFAULT: '#D4AF37',
          dark: '#B8972E',
        },
        green: {
          DEFAULT: '#1A2F24',
          dark: '#112218',
        },
      },
      fontFamily: {
        sans: ['var(--font-manrope)', 'var(--font-inter)', 'var(--font-outfit)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-cormorant)', 'var(--font-playfair)', 'Georgia', 'serif'],
      },
      boxShadow: {
        luxury: '0 10px 40px -10px rgba(0,0,0,0.08)',
        'luxury-hover': '0 20px 40px -10px rgba(0,0,0,0.12)',
      },
      transitionDuration: {
        fast: '200ms',
        medium: '400ms',
        slow: '800ms',
        reveal: '900ms',
        crossfade: '1400ms',
      },
      keyframes: {
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.25s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;

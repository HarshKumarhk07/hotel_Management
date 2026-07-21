import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#D8B854',
          50: '#FAF8F0',
          100: '#F5ECD0',
          500: '#D8B854',
          600: '#AE963C',
          700: '#8A752A',
        },
        gold: {
          DEFAULT: '#D8B854',
          dark: '#AE963C',
        },
        green: {
          DEFAULT: '#589F19',
          dark: '#2D7F09',
        },
      },
      fontFamily: {
        sans: ['var(--font-outfit)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
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

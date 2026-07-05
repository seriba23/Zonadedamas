import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fafa',
          100: '#ccf2f2',
          200: '#99e6e6',
          300: '#00cccc',
          400: '#00b3b3',
          500: '#009999',
          600: '#008080',
          700: '#004d4d',
          800: '#003333',
          900: '#001919',
          950: '#000d0d',
        },
        // Escala gray (slate). Para texto, bordes, fondos neutros.
        gray: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        // Estado: éxito (verde menta).
        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          600: '#059669',
          700: '#047857',
        },
        // Estado: advertencia (ámbar).
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          600: '#d97706',
          700: '#b45309',
        },
        // Estado: peligro (rojo).
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          600: '#dc2626',
          700: '#b91c1c',
        },
        // Estado: info (azul).
        info: {
          50: '#eff6ff',
          100: '#dbeafe',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        // Accent: morado (uso ocasional, ej. profesionista independiente).
        purple: {
          50: '#faf5ff',
          100: '#f3e8ff',
          600: '#9333ea',
          700: '#7e22ce',
        },
      },
      fontFamily: { sans: ['var(--font-manrope)', 'Manrope', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};

export default config;

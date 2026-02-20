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
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};

export default config;

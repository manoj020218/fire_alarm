import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: { DEFAULT: '#0F172A', accent: '#1E3A5F', border: '#1E293B' },
        brand: { red: '#EF4444', green: '#22C55E', amber: '#F59E0B', blue: '#1D4ED8' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
} satisfies Config;

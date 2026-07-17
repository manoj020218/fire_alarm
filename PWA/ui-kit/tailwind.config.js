/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
        },
        violet: {
          DEFAULT: '#7C3AED',
        },
        status: {
          ok: '#22C55E',
          warning: '#F59E0B',
          critical: '#EF4444',
          idle: '#94A3B8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}

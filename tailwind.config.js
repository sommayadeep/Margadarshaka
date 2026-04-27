/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        neon: '0 0 24px rgba(34, 197, 94, 0.28)',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: 0.4, transform: 'scale(0.96)' },
          '50%': { opacity: 1, transform: 'scale(1.04)' },
        },
        drift: {
          '0%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-4px)' },
          '100%': { transform: 'translateY(0px)' },
        },
      },
      animation: {
        pulseGlow: 'pulseGlow 2.2s ease-in-out infinite',
        drift: 'drift 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
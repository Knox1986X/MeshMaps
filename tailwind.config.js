/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        ink: {
          950: '#070a10',
          900: '#0b0f16',
          850: '#10151f',
          800: '#151b26',
          700: '#1e2633',
          600: '#2b3545',
        },
        glass: 'rgb(var(--glass) / <alpha-value>)',
        accent: {
          DEFAULT: '#4f8cff',
          soft: '#8fb4ff',
          deep: '#2b62d1',
        },
        lime: '#a3e635',
        amber: '#fbbf24',
        danger: '#f87171',
      },
      boxShadow: {
        panel: '0 18px 48px -12px rgba(3, 7, 18, 0.65), 0 2px 6px rgba(3,7,18,.35)',
        float: '0 8px 24px -8px rgba(3, 7, 18, 0.55)',
        glow: '0 0 0 1px rgba(79,140,255,.35), 0 0 24px rgba(79,140,255,.35)',
      },
      borderRadius: {
        xl2: '18px',
        xl3: '26px',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(.22,.61,.36,1)',
      },
      keyframes: {
        floatIn: {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        pulsing: {
          '0%,100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '.55', transform: 'scale(1.35)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        floatIn: 'floatIn .32s cubic-bezier(.22,.61,.36,1) both',
        pulsing: 'pulsing 2s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
      },
    },
  },
  plugins: [],
}

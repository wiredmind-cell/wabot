/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // WhatsApp green palette
        wa: {
          50:  '#e8faf2',
          100: '#c3f1de',
          200: '#86e4bc',
          300: '#4dd49a',
          400: '#25D366', // WhatsApp classic green
          500: '#128C7E', // WhatsApp teal
          600: '#075E54', // WhatsApp dark teal
          700: '#054d44',
          800: '#033c35',
          900: '#012b27',
        },
        // Dark neutral palette for the dashboard
        surface: {
          50:  '#f8f9fa',
          100: '#1a1d23',
          200: '#151820',
          300: '#11141b',
          400: '#0d1016',
          500: '#090c12',
        },
        ink: {
          muted: '#6b7280',
          soft:  '#9ca3af',
          base:  '#d1d5db',
          bright:'#f3f4f6',
        }
      },
      fontFamily: {
        sans:  ['DM Sans', 'system-ui', 'sans-serif'],
        mono:  ['DM Mono', 'monospace'],
      },
      backgroundImage: {
        'grid-dark': `linear-gradient(rgba(37,211,102,0.04) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(37,211,102,0.04) 1px, transparent 1px)`,
      },
      backgroundSize: {
        'grid': '24px 24px',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'fade-up': 'fadeUp 0.4s ease forwards',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        }
      }
    }
  },
  plugins: [],
}

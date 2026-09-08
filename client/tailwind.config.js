/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      spacing: {
        '0.5': '2px',
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
        '10': '40px',
        '12': '48px',
        '16': '64px',
        '20': '80px',
        '24': '96px',
      },
      colors: {
        cyber: {
          bg: '#0a0a0f',
          card: 'rgba(20, 20, 35, 0.8)',
          neon: {
            green: '#00ff88',
            pink: '#ff00ff',
            blue: '#00d4ff',
          },
          border: 'rgba(0, 255, 136, 0.2)',
        },
      },
      boxShadow: {
        'neon': '0 0 20px rgba(0, 255, 136, 0.15)',
        'neon-lg': '0 0 40px rgba(0, 255, 136, 0.25)',
        'neon-pink': '0 0 20px rgba(255, 0, 255, 0.15)',
        'neon-blue': '0 0 20px rgba(0, 212, 255, 0.15)',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'scanline-btn': 'scanlineBtn 0.6s ease-out',
        'cursor-blink': 'cursorBlink 1.06s step-end infinite',
        'ink-reveal': 'inkReveal 0.8s ease-out forwards',
        'neon-glow-pulse': 'neonPulse 2s ease-in-out infinite',
      },
      keyframes: {
        scanlineBtn: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        cursorBlink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        inkReveal: {
          '0%': { clipPath: 'inset(0 100% 0 0)', opacity: '0' },
          '100%': { clipPath: 'inset(0 0 0 0)', opacity: '1' },
        },
        neonPulse: {
          '0%, 100%': { boxShadow: '0 0 10px var(--color-glow)' },
          '50%': { boxShadow: '0 0 25px var(--color-glow), 0 0 50px var(--color-glow)' },
        },
      },
    },
  },
  plugins: [],
}

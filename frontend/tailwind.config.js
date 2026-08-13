/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './*.{tsx,ts,html}',
    './pages/**/*.{tsx,ts}',
    './components/**/*.{tsx,ts}',
    './ui/**/*.{tsx,ts}',
    './contexts/**/*.{tsx,ts}',
    './hooks/**/*.{tsx,ts}',
    './lib/**/*.{tsx,ts}',
    './src/**/*.{tsx,ts}',
    './data/**/*.{tsx,ts}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        teal: {
          50:  '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
      },
      animation: {
        'fade-in-up':   'fadeInUp 0.8s ease-out forwards',
        'float':        'float 6s ease-in-out infinite',
        'pulse-slow':   'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in':      'fadeIn 0.3s ease-out forwards',
        'scale-in':     'scaleIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'shimmer':      'shimmer 2.5s linear infinite',
        'pulse-glow':   'pulseGlow 2s ease-in-out infinite',
        'draw-path':    'drawPath 2s ease-out forwards',
        'flow-line':    'flowLine 1s linear infinite',
        'glass-shine':  'glassShine 3s ease-in-out infinite',
        'border-glow':  'borderGlow 3s ease-in-out infinite',
        'shake':        'shake 0.5s ease-in-out',
        'slide-up':     'slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      },
      keyframes: {
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%':   { transform: 'scale(0.85) translateY(10px)', opacity: '0' },
          '100%': { transform: 'scale(1) translateY(0)',       opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseGlow: {
          '0%, 100%': { transform: 'scale(1)',    boxShadow: '0 0 15px rgba(20, 184, 166, 0.3)' },
          '50%':      { transform: 'scale(1.02)', boxShadow: '0 0 25px rgba(20, 184, 166, 0.6)' },
        },
        drawPath: {
          to: { strokeDashoffset: '0' },
        },
        flowLine: {
          from: { strokeDashoffset: '20' },
          to:   { strokeDashoffset: '0' },
        },
        glassShine: {
          '0%':   { backgroundPosition: '-200% 0' },
          '50%':  { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        borderGlow: {
          '0%, 100%': { borderColor: 'rgba(20, 184, 166, 0.15)' },
          '50%':      { borderColor: 'rgba(20, 184, 166, 0.40)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%':      { transform: 'translateX(-4px)' },
          '40%':      { transform: 'translateX(4px)' },
          '60%':      { transform: 'translateX(-3px)' },
          '80%':      { transform: 'translateX(2px)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

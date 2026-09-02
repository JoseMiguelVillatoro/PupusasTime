/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    screens: {
      xs: '400px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
    },

    extend: {
      colors: {
        cream: {
          50: '#FDFBF7',
          100: '#FAF4EA',
          200: '#F3E8D4',
          300: '#E9D6B8',
        },
        terracotta: {
          50: '#FBF1ED',
          100: '#F5D9CE',
          200: '#E9B196',
          300: '#DC8A60',
          400: '#C96A3D',
          500: '#B0542B',
          600: '#8E4020',
          700: '#6B3018',
        },
        olive: {
          50: '#F4F6EE',
          100: '#E5EAD3',
          200: '#C9D49E',
          300: '#A9BC73',
          400: '#8AA24F',
          500: '#6E8239',
          600: '#55682C',
        },
        charcoal: {
          700: '#3A332C',
          800: '#2A2520',
          900: '#1C1814',
        },
        // Dark mode surface palette — warm dark, not pure black
        night: {
          50: '#2A2520',
          100: '#242019',
          200: '#1F1B16',
          300: '#1A1611',
          400: '#15110D',
          500: '#100D0A',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Nunito"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        soft: '0 2px 12px -2px rgba(60, 40, 20, 0.10)',
        card: '0 4px 20px -6px rgba(60, 40, 20, 0.14)',
        pop: '0 8px 28px -8px rgba(176, 84, 43, 0.30)',
      },
      keyframes: {
        pop: {
          '0%': { transform: 'scale(1)' },
          '45%': { transform: 'scale(1.18)' },
          '100%': { transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-4deg)' },
          '50%': { transform: 'rotate(4deg)' },
        },
      },
      animation: {
        pop: 'pop 320ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        slideUp: 'slideUp 380ms cubic-bezier(0.22, 1, 0.36, 1) both',
        slideInRight: 'slideInRight 360ms cubic-bezier(0.22, 1, 0.36, 1) both',
        fadeIn: 'fadeIn 300ms ease both',
        wiggle: 'wiggle 600ms ease-in-out',
      },
    },
  },
  plugins: [],
};

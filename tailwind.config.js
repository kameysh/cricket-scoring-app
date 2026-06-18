/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral UI scale — near-black text, cool light-gray surfaces (Gemini-style monochrome chrome)
        ink: {
          25: '#fbfbfc',
          50: '#f6f7f9',
          100: '#eceef1',
          200: '#dfe2e7',
          300: '#c3c8d1',
          400: '#9aa1ad',
          500: '#717786',
          600: '#535966',
          700: '#383d47',
          800: '#22252c',
          900: '#131314',
          950: '#0a0a0b',
        },
        // Signature accent gradient stops — used sparingly, like Gemini's brand gradient
        brand: {
          green: '#16a34a',
          teal: '#0ea5a8',
          blue: '#2563eb',
        },
        'cricket-green': {
          50: '#eefbf3',
          100: '#d6f5e0',
          200: '#aeebc4',
          300: '#74d99e',
          400: '#3dbf7b',
          DEFAULT: '#178a52',
          500: '#178a52',
          600: '#0f7344',
          700: '#0c5c38',
          800: '#0a4a2e',
          900: '#083d27',
          light: '#1ea868',
          dark: '#0a4a2e',
        },
        'cricket-gold': {
          50: '#fdf8ec',
          100: '#faedc9',
          200: '#f3d98c',
          300: '#eac24f',
          DEFAULT: '#e0a929',
          500: '#e0a929',
          600: '#bd8a1c',
          700: '#946c18',
          light: '#eec25a',
          dark: '#946c18',
        },
        'cricket-pitch': { DEFAULT: '#c8a96e', light: '#dcc394', dark: '#a8895a' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        brand: 'linear-gradient(115deg, #16a34a 0%, #0ea5a8 55%, #2563eb 100%)',
        'brand-soft': 'linear-gradient(115deg, rgba(22,163,74,0.12) 0%, rgba(14,165,168,0.12) 55%, rgba(37,99,235,0.12) 100%)',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(15, 23, 42, 0.03), 0 6px 16px -4px rgba(15, 23, 42, 0.07)',
        'card-hover': '0 8px 24px -4px rgba(15, 23, 42, 0.12)',
        glow: '0 0 0 4px rgba(22, 163, 74, 0.10)',
        pill: '0 1px 2px rgba(15, 23, 42, 0.06), 0 4px 10px -2px rgba(15, 23, 42, 0.08)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
};

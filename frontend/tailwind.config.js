/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        landing: {
          dark: '#0A192F',
          darker: '#020C1B',
          gold: '#FFD700',
          neon: '#00BFFF',
          terminal: '#00FF00',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Times New Roman"', 'Georgia', 'serif'],
        mono: ['Consolas', 'Monaco', '"Courier New"', 'monospace'],
      },
    },
  },
  plugins: [],
}

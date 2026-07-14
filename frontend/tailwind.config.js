/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        surface: '#121212',
        primary: '#3b82f6',
        secondary: '#1e293b',
        border: '#333333',
        textMain: '#ffffff',
        textMuted: '#9ca3af'
      }
    },
  },
  plugins: [],
}

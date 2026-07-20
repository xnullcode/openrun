/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#131417',
        surface: '#1e1f25',
        primary: '#b4c5ff',
        secondary: '#2b2d35',
        border: '#3f414a',
        textMain: '#f4f4f5',
        textMuted: '#a1a1aa'
      }
    },
  },
  plugins: [],
}

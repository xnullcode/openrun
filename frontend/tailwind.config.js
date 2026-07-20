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
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        border: 'var(--color-border)',
        textMain: 'var(--color-text-main)',
        textMuted: 'var(--color-text-muted)'
      }
    },
  },
  plugins: [],
}

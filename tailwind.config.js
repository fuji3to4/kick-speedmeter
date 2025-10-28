/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0b0f14',
        fg: '#eaf2ff',
        muted: '#9bb0c9',
        accent: '#4da3ff',
        panel: '#121923',
        ok: '#38c172',
      },
      borderRadius: {
        xl: '12px',
      }
    },
  },
  plugins: [],
};
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'pdf-bg': '#525659',
        'toolbar-bg': '#2c2c2c',
        'tab-bg': '#3c3c3c',
        'tab-active': '#1e1e1e'
      },
      spacing: {
        'toolbar': '60px',
        'tabs': '40px',
        'statusbar': '30px'
      },
      height: {
        'tabs': '40px'
      }
    },
  },
  plugins: [],
}
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2C9A7A',
          light: '#3DB890',
          dark: '#1F7A5E',
          text: '#FFFFFF'
        }
      }
    }
  },
  plugins: []
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sticky: {
          yellow: '#FAC775',
          text: '#BA7517'
        }
      }
    }
  },
  plugins: []
}

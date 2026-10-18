/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        coral: {
          400: '#f87171',
          500: '#ef4444',
        },
      },
    },
  },
  plugins: [],
}

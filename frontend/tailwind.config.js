/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#0F1F3D',
          'navy-light': '#1E2D4A',
          'navy-dark': '#081225',
          orange: '#FF6B00',
          'orange-hover': '#E05E00',
          'orange-light': '#FF8A33',
          'orange-glow': 'rgba(255, 107, 0, 0.15)',
          gray: '#F8FAFC',
          'gray-dark': '#64748B',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
      },
      boxShadow: {
        'premium': '0 4px 20px -2px rgba(15, 31, 61, 0.08)',
        'premium-orange': '0 4px 20px -2px rgba(255, 107, 0, 0.15)',
        'glass': '0 8px 32px 0 rgba(15, 31, 61, 0.08)',
      },
      backdropBlur: {
        'xs': '2px',
      }
    },
  },
  plugins: [],
}

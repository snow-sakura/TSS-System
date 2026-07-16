/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './web/templates/**/*.html',
    './web/static/js/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        // 日系清新暖色调 - 主色
        'warm': {
          50: '#FEF9F4',
          100: '#FCF3EB',
          200: '#F7EDE4',
          300: '#EDE0D4',
          400: '#E8C9A8',
          500: '#D4A574',
          600: '#C08D5E',
          700: '#A0764A',
          800: '#8D6E63',
          900: '#5D4037',
        },
        // 暖杏色 - 主色
        'apricot': {
          50: '#FFF8F0',
          100: '#FCF3EB',
          200: '#F7EDE4',
          300: '#F2D8C6',
          400: '#E8C9A8',
          500: '#D4A574',
          600: '#C08D5E',
          700: '#A0764A',
        },
        // 辅助暖色
        'blush': {
          50: '#FFF5F3',
          100: '#FFEBE8',
          200: '#FADBD6',
          300: '#F4C7AB',
          400: '#E8A87C',
        },
      },
      fontFamily: {
        'sans': ['"Noto Sans SC"', 'Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      borderRadius: {
        'sm': '6px',
        'md': '10px',
        'lg': '14px',
        'xl': '16px',
      },
      boxShadow: {
        'soft': '0 1px 3px rgba(93, 64, 55, 0.06)',
        'card': '0 4px 12px rgba(93, 64, 55, 0.08)',
        'elevated': '0 8px 24px rgba(93, 64, 55, 0.10)',
        'warm-lg': '0 12px 36px rgba(93, 64, 55, 0.12)',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
}

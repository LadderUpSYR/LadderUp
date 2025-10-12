/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./public/index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: { 
    extend: {
      colors: {
        'sky-blue': '#87CEEB',
      },
      animation: {
        'float': 'float var(--float-duration, 10s) linear infinite',
        'fade-in-up': 'fade-in-up 0.8s ease-out forwards',
        'bounce-slow': 'bounce-slow 3s ease-in-out infinite',
        'gradient': 'gradient 4s ease infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { 
            transform: 'translateY(0px) translateX(0px)',
            opacity: '0.2'
          },
          '50%': { 
            transform: 'translateY(-20px) translateX(10px)',
            opacity: '0.4'
          },
        },
        'fade-in-up': {
          'from': {
            opacity: '0',
            transform: 'translateY(30px)',
          },
          'to': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'bounce-slow': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        gradient: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
      },
      backgroundSize: {
        '300%': '300% 300%',
      },
    } 
  },
  plugins: [],
};

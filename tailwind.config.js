const c = (v) => `hsl(var(--${v}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        background: c('background'),
        foreground: c('foreground'),
        card: c('card'),
        muted: { DEFAULT: c('muted'), foreground: c('muted-foreground') },
        border: c('border'),
        input: c('input'),
        ring: c('ring'),
        primary: { DEFAULT: c('primary'), foreground: c('primary-foreground') },
        accent: { DEFAULT: c('accent'), foreground: c('accent-foreground') },
        aqi: {
          good: c('aqi-good'),
          moderate: c('aqi-moderate'),
          poor: c('aqi-poor'),
          'very-poor': c('aqi-very-poor'),
          severe: c('aqi-severe'),
        },
      },
      borderRadius: { lg: '10px', md: '8px', sm: '6px' },
      keyframes: {
        pageIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: { 'page-in': 'pageIn .25s ease-out' },
    },
  },
}

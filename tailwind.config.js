/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // System fonts only: nothing to download, no layout shift (rule 7).
        display: ['ui-rounded', '"SF Pro Rounded"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        body: ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      colors: {
        // Colours are CSS variables so the Cozy look can swap the night sky for cream and cocoa (see index.css).
        night: Object.fromEntries([950, 900, 800, 700, 600, 500, 400, 300].map((shade) => [shade, `rgb(var(--night-${shade}) / <alpha-value>)`])),
        white: 'rgb(var(--ink) / <alpha-value>)',
      },
      boxShadow: {
        chunky: '0 5px 0 0 rgb(var(--shadow))',
        'chunky-sm': '0 3px 0 0 rgb(var(--shadow))',
        glow: '0 0 24px -4px rgba(250, 204, 21, 0.55)',
      },
      borderRadius: { blob: '1.25rem' },
      minHeight: { tap: '48px' },
      minWidth: { tap: '48px' },
    },
  },
  plugins: [],
};

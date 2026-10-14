/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        // Finger-first devices: larger touch targets for the shell controls.
        coarse: { raw: '(pointer: coarse)' },
      },
      colors: {
        abyss: '#020813',
        ocean: '#061725',
        cyan: { DEFAULT: '#00D9FF', light: '#67F0FF' },
        ink: '#F4F8FC',
        mute: '#94AABD',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

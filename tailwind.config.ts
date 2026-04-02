import type { Config } from 'tailwindcss';

export default {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        brand: '#6366f1',
      },
    },
  },
  plugins: [],
} satisfies Config;

import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: 'var(--card)',
        primary: 'var(--primary)',
        muted: 'var(--muted)',
        accent: 'var(--accent)',
        destructive: 'var(--destructive)',
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from 'tailwindcss';
import { tailwindDesignTokens } from '@vexel/ui-system/tokens';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ...tailwindDesignTokens.colors,
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: tailwindDesignTokens.borderRadius as any,
      spacing: tailwindDesignTokens.spacing as any,
      fontSize: tailwindDesignTokens.fontSize as any,
      fontFamily: tailwindDesignTokens.fontFamily as any,
      boxShadow: tailwindDesignTokens.boxShadow as any,
    },
  },
  plugins: [],
};

export default config;

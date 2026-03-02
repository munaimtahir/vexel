export const colorScale = {
  primary: {
    DEFAULT: 'hsl(var(--primary))',
    foreground: 'hsl(var(--primary-foreground))',
  },
  secondary: {
    DEFAULT: 'hsl(var(--secondary))',
    foreground: 'hsl(var(--secondary-foreground))',
  },
  muted: {
    DEFAULT: 'hsl(var(--muted))',
    foreground: 'hsl(var(--muted-foreground))',
  },
  border: {
    DEFAULT: 'hsl(var(--border))',
  },
  success: {
    DEFAULT: 'hsl(var(--status-success-bg))',
    foreground: 'hsl(var(--status-success-fg))',
    border: 'hsl(var(--status-success-border))',
  },
  danger: {
    DEFAULT: 'hsl(var(--status-destructive-bg))',
    foreground: 'hsl(var(--status-destructive-fg))',
    border: 'hsl(var(--status-destructive-border))',
  },
} as const;

export const backgroundHierarchy = {
  surface1: 'hsl(var(--background))',
  surface2: 'hsl(var(--card))',
  surface3: 'hsl(var(--muted))',
} as const;

export const radiusScale = {
  sm: 'calc(var(--radius) - 4px)',
  md: 'calc(var(--radius) - 2px)',
  lg: 'var(--radius)',
  xl: 'calc(var(--radius) + 4px)',
} as const;

export const spacingScale = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  10: '40px',
  12: '48px',
  14: '56px',
  16: '64px',
} as const;

export const typographyScale = {
  xs: ['0.75rem', { lineHeight: '1rem' }],
  sm: ['0.875rem', { lineHeight: '1.25rem' }],
  base: ['1rem', { lineHeight: '1.5rem' }],
  lg: ['1.125rem', { lineHeight: '1.75rem' }],
  xl: ['1.25rem', { lineHeight: '1.75rem' }],
  '2xl': ['1.5rem', { lineHeight: '2rem' }],
  '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
} as const;

export const layoutTokens = {
  headerHeight: '60px',
  sidebarExpandedWidth: '240px',
  sidebarCollapsedWidth: '64px',
  contentMaxWidth: '1400px',
} as const;

export const tailwindDesignTokens = {
  colors: {
    border: 'hsl(var(--border))',
    input: 'hsl(var(--input))',
    ring: 'hsl(var(--ring))',
    background: 'hsl(var(--background))',
    foreground: 'hsl(var(--foreground))',
    primary: colorScale.primary,
    secondary: colorScale.secondary,
    muted: colorScale.muted,
    destructive: {
      DEFAULT: 'hsl(var(--destructive))',
      foreground: 'hsl(var(--destructive-foreground))',
    },
    success: colorScale.success,
    danger: colorScale.danger,
    card: {
      DEFAULT: 'hsl(var(--card))',
      foreground: 'hsl(var(--card-foreground))',
    },
    sidebar: {
      DEFAULT: 'hsl(var(--sidebar))',
      foreground: 'hsl(var(--sidebar-foreground))',
      muted: 'hsl(var(--sidebar-muted))',
      accent: 'hsl(var(--sidebar-accent))',
      'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
      border: 'hsl(var(--sidebar-border))',
      highlight: 'hsl(var(--sidebar-highlight))',
    },
  },
  borderRadius: radiusScale,
  spacing: spacingScale,
  fontSize: typographyScale,
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
  },
  boxShadow: {
    xs: 'var(--shadow-xs)',
    card: 'var(--shadow-sm)',
    'card-hover': 'var(--shadow-md)',
    float: 'var(--shadow-lg)',
  },
} as const;

/**
 * Design Tokens for Enterprise Governance Dashboard v2
 *
 * Defines spacing, typography, colors, and layout patterns
 * for a professional, accessible, procurement-friendly UI.
 */

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '24px',
};

export const radius = {
  sm: '4px',
  md: '8px',
};

export const typography = {
  heading: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#172b4d',
  },
  subheading: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#172b4d',
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#626f86',
  },
  body: {
    fontSize: '14px',
    fontWeight: '400',
    color: '#44546f',
  },
  small: {
    fontSize: '12px',
    fontWeight: '400',
    color: '#8590a2',
  },
};

export const colors = {
  neutral: {
    white: '#ffffff',
    gray50: '#f1f2f4',
    gray100: '#dfe1e6',
    gray200: '#a6c5d0',
    text: '#172b4d',
    textMuted: '#626f86',
    textHint: '#8590a2',
  },
  status: {
    success: '#216e4e',
    warning: '#974f0c',
    danger: '#ae2a19',
    info: '#0052cc',
  },
};

export const shadows = {
  card: '0 1px 1px rgba(9, 30, 66, 0.13)',
};

export const cardStyle = {
  background: colors.neutral.white,
  border: `1px solid ${colors.neutral.gray100}`,
  borderRadius: radius.md,
  padding: spacing.lg,
  marginBottom: spacing.lg,
  boxShadow: shadows.card,
};

export const sectionTitleStyle = {
  fontSize: '16px',
  fontWeight: '600',
  color: colors.neutral.text,
  marginBottom: spacing.md,
  paddingBottom: spacing.md,
  borderBottom: `1px solid ${colors.neutral.gray100}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

/**
 * Convert tokens to CSS string for inline styles
 */
export function objectToStyle(obj: Record<string, string | number>): string {
  return Object.entries(obj)
    .map(([key, value]) => {
      // Convert camelCase to kebab-case
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${cssKey}: ${value}`;
    })
    .join('; ');
}

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:     'border-transparent bg-primary text-primary-foreground',
        secondary:   'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
        outline:     'border-border text-foreground bg-transparent',
        success:     'border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
        warning:     'border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
        info:        'border-transparent bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
        purple:      'border-transparent bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

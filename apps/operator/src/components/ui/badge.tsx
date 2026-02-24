import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:     'border-transparent bg-primary text-primary-foreground',
        secondary:   'border-[hsl(32,14%,76%)] bg-[hsl(32,18%,90%)] text-[hsl(25,22%,28%)]',
        destructive: 'border-transparent bg-[hsl(0,28%,88%)] text-[hsl(0,38%,40%)]',
        outline:     'border-border text-foreground bg-transparent',
        success:     'border-transparent bg-[hsl(143,22%,85%)] text-[hsl(143,28%,32%)]',
        warning:     'border-transparent bg-[hsl(40,40%,86%)] text-[hsl(36,38%,32%)]',
        info:        'border-transparent bg-[hsl(205,30%,86%)] text-[hsl(205,38%,28%)]',
        purple:      'border-transparent bg-[hsl(229,25%,86%)] text-[hsl(229,30%,30%)]',
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

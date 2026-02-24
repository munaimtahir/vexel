import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:     'gradient-primary text-primary-foreground shadow-xs hover:opacity-90 active:scale-[.98]',
        destructive: 'bg-[hsl(0,28%,88%)] text-[hsl(0,38%,38%)] border border-[hsl(0,28%,78%)] hover:bg-[hsl(0,28%,82%)] shadow-xs',
        outline:     'border border-input bg-card hover:bg-[hsl(32,18%,94%)] hover:text-foreground',
        secondary:   'bg-secondary text-secondary-foreground hover:bg-[hsl(32,18%,84%)]',
        ghost:       'hover:bg-[hsl(32,14%,90%)] hover:text-foreground',
        link:        'text-primary underline-offset-4 hover:underline',
        accent:      'gradient-accent text-white shadow-xs hover:opacity-90 active:scale-[.98]',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm:      'h-8 rounded-md px-3 text-xs',
        lg:      'h-10 rounded-lg px-8',
        icon:    'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };

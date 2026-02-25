import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

const ICON_COLORS = [
  'from-primary to-primary/85',
  'from-primary to-primary/90',
  'from-primary to-primary/80',
  'from-primary to-primary/75',
  'from-primary to-primary/80',
];

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: { value: string; positive: boolean };
  className?: string;
  colorIndex?: number;
}

export function StatCard({ label, value, icon: Icon, trend, className, colorIndex = 0 }: StatCardProps) {
  const iconGradient = ICON_COLORS[colorIndex % ICON_COLORS.length];
  return (
    <Card className={cn('transition-shadow hover:shadow-card-hover', className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest truncate">{label}</p>
            <p className="text-2xl font-bold mt-1.5 text-foreground">{value}</p>
            {trend && (
              <p className={cn('text-xs mt-1.5 font-medium', trend.positive ? 'text-[hsl(var(--status-success-fg))]' : 'text-[hsl(var(--status-destructive-fg))]')}>{trend.value}</p>
            )}
          </div>
          {Icon && (
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-xs text-white flex-shrink-0 ml-3', iconGradient)}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

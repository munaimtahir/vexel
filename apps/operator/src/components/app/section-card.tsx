import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SectionCardProps {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function SectionCard({ title, actions, children, className, noPadding }: SectionCardProps) {
  return (
    <Card className={cn('', className)}>
      {(title || actions) && (
        <CardHeader className="flex flex-row items-center justify-between py-4">
          {title && <CardTitle className="text-sm font-semibold">{title}</CardTitle>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </CardHeader>
      )}
      <CardContent className={cn(noPadding ? 'p-0' : title || actions ? 'pt-0' : '')}>
        {children}
      </CardContent>
    </Card>
  );
}

import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
  variant?: 'default' | 'dark';
  icon?: React.ReactNode;
}

export const MetricCard = ({ 
  title, 
  value, 
  trend, 
  subtitle, 
  variant = 'default',
  icon 
}: MetricCardProps) => {
  return (
    <div className={cn(
      variant === 'dark' ? 'metric-card-dark' : 'metric-card',
      'animate-fade-in h-full'
    )}>
      <div className="flex items-start justify-between mb-3">
        <p className={cn(
          "text-xs font-semibold uppercase tracking-wider",
          variant === 'dark' ? 'text-card-dark-foreground/70' : 'text-muted-foreground'
        )}>
          {title}
        </p>
        {icon && (
          <div className={cn(
            "p-2 rounded-lg flex-shrink-0",
            variant === 'dark' ? 'bg-white/10' : 'bg-primary/10'
          )}>
            {icon}
          </div>
        )}
      </div>
      
      <div className="mb-2">
        <p className={cn(
          "text-2xl sm:text-3xl font-bold tracking-tight",
          variant === 'dark' ? 'text-card-dark-foreground' : 'text-foreground'
        )}>
          {value}
        </p>
      </div>
      
      {(trend || subtitle) && (
        <div className="flex items-center gap-2 mt-3">
          {trend && (
            <div className={cn(
              "flex items-center gap-1 text-sm font-medium",
              trend.isPositive 
                ? variant === 'dark' 
                  ? 'text-success-light' 
                  : 'text-success'
                : variant === 'dark'
                  ? 'text-danger-light'
                  : 'text-danger'
            )}>
              {trend.isPositive ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
          {subtitle && (
            <p className={cn(
              "text-xs",
              variant === 'dark' ? 'text-card-dark-foreground/60' : 'text-muted-foreground'
            )}>
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

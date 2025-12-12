import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@wine-club/ui";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: {
    value: number; // Percentage change
    label?: string; // e.g., "vs last month"
  };
  icon?: React.ReactNode;
  href?: string;
}

export function MetricCard({
  title,
  value,
  description,
  trend,
  icon,
  href,
}: MetricCardProps) {
  const content = (
    <Card className={href ? "hover:bg-accent/50 transition-colors cursor-pointer" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription className="text-sm font-medium">{title}</CardDescription>
          {icon && <span className="text-muted-foreground">{icon}</span>}
        </div>
        <CardTitle className="text-3xl font-bold">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          {trend !== undefined && (
            <TrendIndicator value={trend.value} label={trend.label} />
          )}
          {description && !trend && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
          {description && trend && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {content}
      </a>
    );
  }

  return content;
}

interface TrendIndicatorProps {
  value: number;
  label?: string;
}

function TrendIndicator({ value, label }: TrendIndicatorProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const isNeutral = value === 0;

  return (
    <div className="flex items-center gap-1">
      {isPositive && (
        <>
          <TrendingUp className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-600">
            +{value.toFixed(1)}%
          </span>
        </>
      )}
      {isNegative && (
        <>
          <TrendingDown className="h-4 w-4 text-red-600" />
          <span className="text-sm font-medium text-red-600">
            {value.toFixed(1)}%
          </span>
        </>
      )}
      {isNeutral && (
        <>
          <Minus className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            0%
          </span>
        </>
      )}
      {label && (
        <span className="text-xs text-muted-foreground ml-1">{label}</span>
      )}
    </div>
  );
}

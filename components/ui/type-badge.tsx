import { Badge } from '@/components/ui/badge';
import {
  TrendingDown,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import type { PriorityType } from '@/lib/scoring/types';
import { TYPE_BADGE_CLASSES, TYPE_LABELS } from '@/lib/ui/tier-type-styles';

const TYPE_ICON_MAP: Record<PriorityType, React.ElementType> = {
  churn_risk: TrendingDown,
  renewal_urgent: Clock,
  expansion_opportunity: TrendingUp,
  mixed_signals: AlertTriangle,
  stable: CheckCircle,
};

export interface TypeBadgeProps {
  type: PriorityType;
  size?: 'sm' | 'md';
}

const sizeStyles: Record<NonNullable<TypeBadgeProps['size']>, string> = {
  sm: 'text-[10px] px-1.5 py-0',
  md: 'text-xs px-2 py-0.5',
};

export function TypeBadge({ type, size = 'md' }: TypeBadgeProps) {
  const Icon = TYPE_ICON_MAP[type];
  return (
    <Badge
      className={`${TYPE_BADGE_CLASSES[type]} ${sizeStyles[size]} font-medium`}
    >
      <Icon className="size-3 mr-0.5" />
      {TYPE_LABELS[type]}
    </Badge>
  );
}

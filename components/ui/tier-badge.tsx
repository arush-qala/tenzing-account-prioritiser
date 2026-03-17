import { Badge } from '@/components/ui/badge'
import type { PriorityTier } from '@/lib/scoring/types'

export interface TierBadgeProps {
  tier: PriorityTier
  size?: 'sm' | 'md'
}

const tierStyles: Record<PriorityTier, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-blue-100 text-blue-800 border-blue-200',
  monitor: 'bg-gray-100 text-gray-600 border-gray-200',
}

const sizeStyles: Record<NonNullable<TierBadgeProps['size']>, string> = {
  sm: 'text-[10px] px-1.5 py-0',
  md: 'text-xs px-2 py-0.5',
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function TierBadge({ tier, size = 'md' }: TierBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={`${tierStyles[tier]} ${sizeStyles[size]} font-semibold`}
    >
      {capitalize(tier)}
    </Badge>
  )
}

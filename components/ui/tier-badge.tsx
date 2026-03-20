import { Badge } from '@/components/ui/badge'
import type { PriorityTier } from '@/lib/scoring/types'
import { TIER_BADGE_CLASSES, TIER_LABELS } from '@/lib/ui/tier-type-styles'

export interface TierBadgeProps {
  tier: PriorityTier
  size?: 'sm' | 'md'
}

const sizeStyles: Record<NonNullable<TierBadgeProps['size']>, string> = {
  sm: 'text-[10px] px-1.5 py-0',
  md: 'text-xs px-2 py-0.5',
}

export function TierBadge({ tier, size = 'md' }: TierBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={`${TIER_BADGE_CLASSES[tier]} ${sizeStyles[size]} font-semibold`}
    >
      {TIER_LABELS[tier]}
    </Badge>
  )
}

'use client'

import { AlertTriangle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface AnomalyBadgeProps {
  isAnomaly: boolean | null
  score?: number | null
}

export function AnomalyBadge({ isAnomaly, score }: AnomalyBadgeProps) {
  if (!isAnomaly) {
    return null
  }

  const badge = (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
      <AlertTriangle className="h-3 w-3" />
      Anomaly
    </span>
  )

  if (score == null) {
    return badge
  }

  return (
    <Tooltip>
      <TooltipTrigger>{badge}</TooltipTrigger>
      <TooltipContent>
        Anomaly score: {score.toFixed(2)}
      </TooltipContent>
    </Tooltip>
  )
}

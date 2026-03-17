'use client'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface DataQualityBadgeProps {
  score: number // 0 to 1
}

function getQualityLevel(score: number): {
  label: string
  className: string
} {
  if (score >= 0.75) {
    return {
      label: 'High',
      className: 'bg-green-100 text-green-800 border-green-200',
    }
  }
  if (score >= 0.5) {
    return {
      label: 'Medium',
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    }
  }
  return {
    label: 'Low',
    className: 'bg-red-100 text-red-800 border-red-200',
  }
}

export function DataQualityBadge({ score }: DataQualityBadgeProps) {
  const { label, className } = getQualityLevel(score)
  const pct = Math.round(score * 100)

  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge variant="outline" className={`${className} text-[10px] font-medium`}>
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        Data completeness: {pct}% of fields populated
      </TooltipContent>
    </Tooltip>
  )
}

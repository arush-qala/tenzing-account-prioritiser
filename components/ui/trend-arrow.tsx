import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TrendArrowProps {
  value: number
  suffix?: string
  invertColor?: boolean
}

export function TrendArrow({ value, suffix = '', invertColor = false }: TrendArrowProps) {
  const isPositive = value > 0
  const isFlat = value === 0

  // Normal: up = green, down = red. Inverted: up = red, down = green.
  const upColor = invertColor ? 'text-red-600' : 'text-green-600'
  const downColor = invertColor ? 'text-green-600' : 'text-red-600'
  const flatColor = 'text-gray-500'

  const formattedValue = isPositive
    ? `+${value}${suffix}`
    : `${value}${suffix}`
  const flatValue = `0${suffix}`

  if (isFlat) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-xs font-medium', flatColor)}>
        <Minus className="h-3.5 w-3.5" />
        {flatValue}
      </span>
    )
  }

  if (isPositive) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-xs font-medium', upColor)}>
        <TrendingUp className="h-3.5 w-3.5" />
        {formattedValue}
      </span>
    )
  }

  // isNegative
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', downColor)}>
      <TrendingDown className="h-3.5 w-3.5" />
      {formattedValue}
    </span>
  )
}

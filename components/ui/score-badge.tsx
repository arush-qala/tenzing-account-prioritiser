import { cn } from '@/lib/utils'

export interface ScoreBadgeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'bg-red-100 text-red-800 border-red-200'
  if (score >= 65) return 'bg-orange-100 text-orange-800 border-orange-200'
  if (score >= 50) return 'bg-amber-100 text-amber-800 border-amber-200'
  if (score >= 35) return 'bg-blue-100 text-blue-800 border-blue-200'
  return 'bg-green-100 text-green-800 border-green-200'
}

const sizeStyles: Record<NonNullable<ScoreBadgeProps['size']>, string> = {
  sm: 'text-[10px] px-1.5 py-0 min-w-[32px]',
  md: 'text-xs px-2 py-0.5 min-w-[40px]',
  lg: 'text-sm px-3 py-1 min-w-[48px]',
}

export function ScoreBadge({ score, size = 'md' }: ScoreBadgeProps) {
  const rounded = Math.round(score * 10) / 10

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full border font-semibold tabular-nums',
        getScoreColor(score),
        sizeStyles[size]
      )}
    >
      {rounded.toFixed(1)}
    </span>
  )
}

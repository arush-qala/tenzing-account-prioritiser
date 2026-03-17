import { cn } from '@/lib/utils'

export interface HealthIndicatorProps {
  value: number
  label?: string
  showValue?: boolean
}

function getBarColor(value: number): string {
  if (value >= 70) return 'bg-green-500'
  if (value >= 50) return 'bg-yellow-500'
  if (value >= 30) return 'bg-orange-500'
  return 'bg-red-500'
}

function getBarBg(value: number): string {
  if (value >= 70) return 'bg-green-100'
  if (value >= 50) return 'bg-yellow-100'
  if (value >= 30) return 'bg-orange-100'
  return 'bg-red-100'
}

export function HealthIndicator({ value, label, showValue }: HealthIndicatorProps) {
  const clamped = Math.max(0, Math.min(100, value))

  return (
    <div className="flex w-full flex-col gap-1">
      {label && (
        <span className="text-[11px] font-medium text-muted-foreground">
          {label}
        </span>
      )}
      <div className="flex items-center gap-2">
        <div
          className={cn('relative h-1 flex-1 overflow-hidden rounded-full', getBarBg(clamped))}
        >
          <div
            className={cn('absolute inset-y-0 left-0 rounded-full transition-all', getBarColor(clamped))}
            style={{ width: `${clamped}%` }}
          />
        </div>
        {showValue && (
          <span className="min-w-[28px] text-right text-[11px] font-medium tabular-nums text-muted-foreground">
            {Math.round(clamped)}
          </span>
        )}
      </div>
    </div>
  )
}

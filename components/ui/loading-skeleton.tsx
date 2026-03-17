import { cn } from '@/lib/utils'

function Bone({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-muted', className)} />
}

/** Skeleton that mimics a summary card */
export function CardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3">
        <Bone className="h-4 w-24" />
        <Bone className="h-8 w-16" />
        <Bone className="h-3 w-32" />
      </div>
    </div>
  )
}

/** Skeleton that mimics a single table row */
export function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b px-4 py-3">
      <Bone className="h-4 w-32" />
      <Bone className="h-4 w-20" />
      <Bone className="h-4 w-16" />
      <Bone className="h-4 w-24" />
      <Bone className="h-4 w-12" />
      <Bone className="ml-auto h-4 w-16" />
    </div>
  )
}

/** Skeleton that mimics the account detail page */
export function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Bone className="h-8 w-48" />
        <Bone className="h-6 w-20" />
        <Bone className="h-6 w-16" />
      </div>

      {/* Summary cards row */}
      <div className="grid grid-cols-4 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>

      {/* Sub-scores section */}
      <div className="rounded-lg border bg-card p-6">
        <Bone className="mb-4 h-5 w-32" />
        <div className="flex flex-col gap-3">
          <Bone className="h-4 w-full" />
          <Bone className="h-4 w-full" />
          <Bone className="h-4 w-full" />
          <Bone className="h-4 w-full" />
          <Bone className="h-4 w-full" />
        </div>
      </div>

      {/* AI analysis section */}
      <div className="rounded-lg border bg-card p-6">
        <Bone className="mb-4 h-5 w-40" />
        <div className="flex flex-col gap-2">
          <Bone className="h-4 w-full" />
          <Bone className="h-4 w-3/4" />
          <Bone className="h-4 w-5/6" />
          <Bone className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  )
}

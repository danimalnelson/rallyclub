function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

/**
 * Skeleton fallback for the main dashboard content:
 * AlertBanner area, 4 metric cards, and the 2-column activity/actions grid.
 */
export function DashboardSkeleton() {
  return (
    <>
      {/* Getting Started / Alert area */}
      <div className="mb-6">
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-lg border bg-card p-6 space-y-3"
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* 2-column: Activity + Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Activity Feed skeleton */}
        <div className="rounded-lg border bg-card p-6 space-y-3">
          <Skeleton className="h-5 w-32 mb-4" />
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>

        {/* Action Items skeleton */}
        <div className="rounded-lg border bg-card p-6 space-y-3">
          <Skeleton className="h-5 w-28 mb-4" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </>
  );
}

/**
 * Skeleton fallback for the revenue chart section.
 */
export function RevenueSkeleton() {
  return (
    <div className="mb-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-6">
            <Skeleton className="h-4 w-32 mb-4" />
            <Skeleton className="h-48 w-full rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

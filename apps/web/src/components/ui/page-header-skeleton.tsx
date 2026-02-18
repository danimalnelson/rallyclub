const SKELETON_CLASS = "animate-pulse rounded bg-gray-200 dark:bg-gray-700";

/**
 * Filter pill skeletons for use in ListView loading state.
 * Renders pill-shaped placeholders in the filter slot.
 */
export function FilterPillSkeletons({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-row items-center gap-1 shrink-0">
      {[...Array(count)].map((_, i) => (
        <div key={i} className={`h-8 w-16 shrink-0 rounded-md ${SKELETON_CLASS}`} />
      ))}
    </div>
  );
}

/**
 * Two-row skeleton matching the DataTable sticky header.
 * Row 1: centered title.  Row 2: filter pills + action button.
 */
export function PageHeaderSkeleton({
  pillCount = 4,
  showAction = true,
  actionWidth = "w-20",
}: {
  pillCount?: number;
  showAction?: boolean;
  actionWidth?: string;
}) {
  return (
    <>
      {/* Row 1: Title */}
      <div className="sticky top-0 z-20 -mx-3 px-3 flex items-center justify-center h-[60px] border-b border-gray-300 dark:border-gray-600 bg-ds-background-200 dark:bg-gray-100">
        <div className={`h-4 w-24 ${SKELETON_CLASS}`} />
      </div>

      {/* Row 2: Filters + Actions */}
      <div className="sticky top-[60px] z-20 -mx-3 px-3 flex items-center gap-2 h-[60px] border-b border-gray-300 dark:border-gray-600 bg-ds-background-200 dark:bg-gray-100">
        <FilterPillSkeletons count={pillCount} />
        <div className="flex-1" />
        {showAction && (
          <div className={`h-8 ${actionWidth} shrink-0 rounded-md ${SKELETON_CLASS}`} />
        )}
      </div>
    </>
  );
}

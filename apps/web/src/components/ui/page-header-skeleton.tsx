import { PAGE_HEADER_BAR_CLASSES } from "./page-header";

const SKELETON_CLASS = "animate-pulse rounded bg-gray-400";

/**
 * Filter pill skeletons for use in ListView loading state.
 * Renders pill-shaped placeholders in the filter slot.
 */
export function FilterPillSkeletons({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-row items-center gap-1.5 shrink-0">
      {[...Array(count)].map((_, i) => (
        <div key={i} className={`h-6 w-14 shrink-0 rounded-full ${SKELETON_CLASS}`} />
      ))}
    </div>
  );
}

/**
 * Loading skeleton for the page header bar.
 * Matches the layout of table headers: title + filter pills + action button.
 */
export function PageHeaderSkeleton({
  pillCount = 4,
  showAction = true,
}: {
  /** Number of filter pill skeletons (default 4) */
  pillCount?: number;
  /** Show action button skeleton (default true) */
  showAction?: boolean;
}) {
  return (
    <div className={`${PAGE_HEADER_BAR_CLASSES} gap-2`}>
      {/* Title skeleton — matches text-sm font-semibold line height */}
      <div className={`h-4 w-20 shrink-0 self-center ${SKELETON_CLASS}`} />

      {/* Filter pill skeletons — h-6 rounded-full matches FilterPill */}
      <div className="flex flex-row items-center gap-1.5 shrink-0 self-center">
        {[...Array(pillCount)].map((_, i) => (
          <div
            key={i}
            className={`h-6 w-14 shrink-0 rounded-full ${SKELETON_CLASS}`}
          />
        ))}
      </div>

      <div className="flex-1 min-w-0" />

      {/* Action button skeleton — h-9 rounded-md matches Export/Add buttons */}
      {showAction && (
        <div className={`h-9 w-20 shrink-0 self-center rounded-md ${SKELETON_CLASS}`} />
      )}
    </div>
  );
}

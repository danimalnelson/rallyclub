"use client";

interface ListSkeletonProps {
  /** Number of columns */
  columnCount?: number;
  /** Number of data rows (excluding header) */
  rowCount?: number;
  /** Optional width classes for each column (e.g. ["w-28", "w-40", "w-16"]) */
  columnWidths?: string[];
}

function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-200 dark:bg-gray-700 h-3.5 ${className}`}
    />
  );
}

/**
 * Full-width loading skeleton for list/table views.
 * Matches the DataTable layout: -mx-3, white bg, no card wrapper.
 */
export function ListSkeleton({
  columnCount = 5,
  rowCount = 8,
  columnWidths,
}: ListSkeletonProps) {
  const widths = columnWidths ?? Array(columnCount).fill("w-24");

  return (
    <div className="-mx-3 overflow-x-auto bg-white dark:bg-gray-100">
      <table className="w-full border-collapse border-0">
        <thead className="border-b border-gray-200 dark:border-gray-700 bg-ds-background-200 dark:bg-gray-100">
          <tr>
            {widths.map((w, i) => (
              <th key={i} className="px-3 h-[42px] text-left">
                <SkeletonBox className={w} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-gray-200 dark:[&>tr]:border-gray-700 [&>tr:last-child]:border-b-0">
          {[...Array(rowCount)].map((_, rowIndex) => (
            <tr key={rowIndex} className="h-[42px]">
              {widths.map((w, i) => (
                <td key={i} className="px-3">
                  <SkeletonBox className={w} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Full-width footer skeleton matching the DataTable footer.
 */
export function ListFooterSkeleton() {
  return (
    <div className="sticky bottom-0 z-20 -mx-3 px-3 flex items-center h-10 border-t border-gray-300 dark:border-gray-600 bg-ds-background-200 dark:bg-gray-100">
      <div className="animate-pulse rounded bg-gray-200 dark:bg-gray-700 h-3 w-16" />
    </div>
  );
}

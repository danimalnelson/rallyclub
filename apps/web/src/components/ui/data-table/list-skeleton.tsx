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
      className={`animate-pulse rounded-md bg-neutral-400 h-3.5 ${className}`}
    />
  );
}

/**
 * Loading skeleton for list/table views.
 * Gray rounded boxes only — no white background, no borders.
 */
export function ListSkeleton({
  columnCount = 5,
  rowCount = 8,
  columnWidths,
}: ListSkeletonProps) {
  const widths = columnWidths ?? Array(columnCount).fill("w-24");

  return (
    <table className="w-full border-collapse border-0">
      <thead>
        <tr>
          {widths.map((w, i) => (
            <th key={i} className="px-3 h-[42px] text-left">
              <SkeletonBox className={w} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
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
  );
}

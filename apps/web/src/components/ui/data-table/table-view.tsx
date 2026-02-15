"use client";

import { cn } from "@wine-club/ui";
import { EmptyState } from "../empty-state";

export interface TableColumn<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  headerClassName?: string;
  cellClassName?: string;
  render: (item: T) => React.ReactNode;
}

interface TableViewProps<T> {
  columns: TableColumn<T>[];
  items: T[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
  emptyDescription?: React.ReactNode;
  onRowClick?: (item: T) => void;
  /** Use variable row height for rows with multi-line content (default: false for compact 42px rows) */
  variableRowHeight?: boolean;
  className?: string;
}

/**
 * Shared table/list view with consistent header row, data rows, and column styling.
 * Matches DataTable styling. Use inside SectionCard or standalone.
 */
export function TableView<T>({
  columns,
  items,
  keyExtractor,
  emptyMessage,
  emptyDescription,
  onRowClick,
  variableRowHeight = false,
  className,
}: TableViewProps<T>) {
  if (items.length === 0 && emptyMessage) {
    return (
      <div className={cn("rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-100 py-12 text-center", className)}>
        <EmptyState message={emptyMessage} description={emptyDescription} />
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  const rowClassName = variableRowHeight
    ? "min-h-[42px] py-3"
    : "h-[42px]";

  return (
    <div className={cn("overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-100", className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="border-b border-gray-400 dark:border-gray-600 bg-ds-background-200 dark:bg-gray-100">
            <tr className="text-left">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "px-3 h-[42px] align-middle font-medium text-sm text-gray-800 dark:text-gray-800",
                    col.align === "right" && "text-right",
                    col.headerClassName
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {items.map((item) => (
              <tr
                key={keyExtractor(item)}
                className={cn(
                  rowClassName,
                  onRowClick && "cursor-pointer"
                )}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-3 text-sm align-middle",
                      col.align === "right" && "text-right",
                      col.cellClassName
                    )}
                  >
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

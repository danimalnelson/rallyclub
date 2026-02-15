import * as React from "react";
import { cn } from "@wine-club/ui";
import { EmptyState } from "./empty-state";

export type DataViewVariant = "spaced" | "divided";

export interface DataViewProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  keyExtractor: (item: T) => string;
  variant?: DataViewVariant;
  emptyMessage?: string;
  emptyDescription?: React.ReactNode;
  className?: string;
}

/**
 * Shared list view for Activity, Members (table mode uses DataTable), and other list data.
 * Use variant="spaced" for Activity-style gaps, variant="divided" for borders between items.
 */
export function DataView<T>({
  items,
  renderItem,
  keyExtractor,
  variant = "divided",
  emptyMessage,
  emptyDescription,
  className,
}: DataViewProps<T>) {
  if (items.length === 0 && emptyMessage) {
    return (
      <div className={`text-center py-8 ${className || ""}`}>
        <EmptyState message={emptyMessage} description={emptyDescription} />
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  if (variant === "spaced") {
    return (
      <div className={cn("space-y-3", className)}>
        {items.map((item) => (
          <React.Fragment key={keyExtractor(item)}>{renderItem(item)}</React.Fragment>
        ))}
      </div>
    );
  }

  return (
    <ul
      className={cn(
        "divide-y divide-gray-200 dark:divide-gray-700",
        className
      )}
    >
      {items.map((item) => (
        <li
          key={keyExtractor(item)}
          className="py-4 first:pt-0 last:pb-0"
        >
          {renderItem(item)}
        </li>
      ))}
    </ul>
  );
}

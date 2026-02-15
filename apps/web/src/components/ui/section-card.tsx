import * as React from "react";
import { cn } from "@wine-club/ui";

/**
 * Reusable section card with a 61px header (60px interior + 1px border).
 * Title on the left, actions/buttons on the right.
 */
export interface SectionCardProps {
  /** Section title (left side of header) */
  title: React.ReactNode;
  /** Optional actions/buttons (right side of header) */
  actions?: React.ReactNode;
  /** Main content below the header */
  children: React.ReactNode;
  className?: string;
}

export const SectionCard = React.forwardRef<HTMLDivElement, SectionCardProps>(
  ({ title, actions, children, className }, ref) => (
    <div
      ref={ref}
      className={cn("w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-100 text-gray-950 dark:text-white shadow-sm overflow-hidden", className)}
    >
      <div className="flex items-center justify-between gap-4 px-6 h-[61px] border-b border-gray-400 dark:border-gray-600 shrink-0">
        <div className="min-w-0 flex-1 overflow-hidden">
          <h2 className="text-lg font-semibold text-gray-950 dark:text-white truncate">{title}</h2>
        </div>
        {actions && (
          <div className="ml-4 shrink-0 flex items-center gap-2">{actions}</div>
        )}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
);
SectionCard.displayName = "SectionCard";

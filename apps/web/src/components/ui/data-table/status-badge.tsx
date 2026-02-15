"use client";

import { cn } from "@wine-club/ui";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "border-green-700 text-green-700 bg-green-100",
  PAYMENT: "border-green-700 text-green-700 bg-green-100",
  CANCELLED: "border-red-700 text-red-700 bg-red-100",
  VOIDED: "border-red-700 text-red-700 bg-red-100",
  PENDING: "border-orange-700 text-orange-700 bg-orange-100",
};

const DEFAULT_STYLE = "border-gray-600 text-gray-600 bg-gray-50 dark:border-gray-700 dark:text-gray-800 dark:bg-gray-200";

interface StatusBadgeProps {
  status: string;
  /** Override the displayed label (defaults to status with underscores replaced by spaces) */
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] || DEFAULT_STYLE;
  const raw = label ?? status.replace(/_/g, " ");
  const displayLabel = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();

  return (
    <span
      role="status"
      aria-label={`Status: ${displayLabel}`}
      className={cn(
        "inline-flex items-center rounded px-1.5 h-5 text-xs font-medium border",
        style,
      )}
    >
      {displayLabel}
    </span>
  );
}

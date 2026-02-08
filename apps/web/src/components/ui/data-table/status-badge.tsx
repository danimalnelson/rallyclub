"use client";

const STATUS_COLORS: Record<string, string> = {
  // Green
  ACTIVE: "bg-green-100 text-green-700",
  PAYMENT: "bg-green-100 text-green-700",
  // Blue
  SUBSCRIPTION_CREATED: "bg-blue-100 text-blue-700",
  // Yellow
  DRAFT: "bg-yellow-100 text-yellow-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  // Orange
  PAUSED: "bg-orange-100 text-orange-700",
  // Red
  VOIDED: "bg-red-100 text-red-700",
  CANCELLED: "bg-red-100 text-red-700",
};

interface StatusBadgeProps {
  status: string;
  /** Override the displayed label (defaults to status with underscores replaced by spaces) */
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const colorClass = STATUS_COLORS[status] || "bg-gray-100 text-gray-700";
  const displayLabel = label ?? status.replace(/_/g, " ");

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {displayLabel}
    </span>
  );
}

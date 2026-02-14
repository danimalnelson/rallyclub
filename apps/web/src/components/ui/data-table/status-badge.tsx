"use client";

const STATUS_STYLES: Record<string, { border: string; text: string; bg: string }> = {
  ACTIVE: { border: "var(--ds-green-700)", text: "var(--ds-green-700)", bg: "var(--ds-green-100)" },
  PAYMENT: { border: "var(--ds-green-700)", text: "var(--ds-green-700)", bg: "var(--ds-green-100)" },
  CANCELLED: { border: "var(--ds-red-700)", text: "var(--ds-red-700)", bg: "var(--ds-red-100)" },
  VOIDED: { border: "var(--ds-red-700)", text: "var(--ds-red-700)", bg: "var(--ds-red-100)" },
  PENDING: { border: "var(--ds-amber-700)", text: "var(--ds-amber-700)", bg: "var(--ds-amber-100)" },
};

const DEFAULT_STYLE = { border: "var(--ds-gray-800)", text: "var(--ds-gray-800)", bg: "var(--ds-background-200)" };

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
      className="inline-flex items-center rounded px-1.5 h-5 font-medium"
      style={{
        fontSize: 12,
        color: style.text,
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
      }}
    >
      {displayLabel}
    </span>
  );
}

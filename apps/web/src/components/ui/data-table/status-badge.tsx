"use client";

const STATUS_STYLES: Record<string, { border: string; text: string; bg: string }> = {
  ACTIVE: { border: "#34C759", text: "#34C759", bg: "rgba(52, 199, 89, 0.08)" },
  PAYMENT: { border: "#34C759", text: "#34C759", bg: "rgba(52, 199, 89, 0.08)" },
  CANCELLED: { border: "#E5484D", text: "#E5484D", bg: "rgba(229, 72, 77, 0.08)" },
  VOIDED: { border: "#E5484D", text: "#E5484D", bg: "rgba(229, 72, 77, 0.08)" },
  PENDING: { border: "#EAB308", text: "#EAB308", bg: "rgba(234, 179, 8, 0.08)" },
};

const DEFAULT_STYLE = { border: "#999", text: "#999", bg: "rgba(153, 153, 153, 0.08)" };

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

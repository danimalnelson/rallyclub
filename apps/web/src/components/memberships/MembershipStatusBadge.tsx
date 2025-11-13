import React from "react";

type MembershipStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";

interface MembershipStatusBadgeProps {
  status: MembershipStatus;
}

const statusConfig = {
  DRAFT: {
    label: "Draft",
    className: "bg-gray-100 text-gray-800",
  },
  ACTIVE: {
    label: "Active",
    className: "bg-green-100 text-green-800",
  },
  PAUSED: {
    label: "Paused",
    className: "bg-yellow-100 text-yellow-800",
  },
  ARCHIVED: {
    label: "Archived",
    className: "bg-red-100 text-red-800",
  },
};

export const MembershipStatusBadge = React.memo(
  ({ status }: MembershipStatusBadgeProps) => {
    const config = statusConfig[status] || statusConfig.DRAFT;

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
      >
        {config.label}
      </span>
    );
  }
);

MembershipStatusBadge.displayName = "MembershipStatusBadge";


"use client";

import React from "react";

/**
 * Shared page header bar styles.
 * - 60px interior height + 1px bottom border = 61px total
 * - Full width (spans parent padding)
 */
export const PAGE_HEADER_BAR_CLASSES =
  "sticky top-0 z-10 -mx-3 px-3 h-[61px] flex items-center border-b border-gray-400 dark:border-gray-600 bg-ds-background-200 dark:bg-gray-100 shrink-0 mb-3";

/**
 * Sticky page header for detail pages.
 * Use for breadcrumb-style titles, e.g. "Members > [Member Name]"
 */
export function PageHeader({ children }: { children: React.ReactNode }) {
  return <div className={PAGE_HEADER_BAR_CLASSES}>{children}</div>;
}

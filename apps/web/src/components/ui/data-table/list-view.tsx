"use client";

import { PAGE_HEADER_BAR_CLASSES } from "../page-header";

interface ListViewProps {
  /** Page title in the header bar */
  title: string;
  /** Filters - pass FilterPillFromConfig, custom filter UI, or null */
  filters?: React.ReactNode;
  /** Action buttons (e.g. Add, Export) */
  actions?: React.ReactNode;
  /** The list/table content */
  children: React.ReactNode;
  /** Optional footer (pagination, result count) */
  footer?: React.ReactNode;
}

/**
 * Page-level list view wrapper. Provides header bar (title, filters, actions)
 * and slots for list content and footer. Use with List for full-page list views
 * (Members, Transactions). Customize filters and footer at the component level.
 */
export function ListView({ title, filters, actions, children, footer }: ListViewProps) {
  return (
    <>
      <div className={`${PAGE_HEADER_BAR_CLASSES} gap-2`}>
        <h1 className="text-sm font-semibold text-foreground w-[120px] shrink-0">{title}</h1>
        {filters && <div className="flex items-center gap-1">{filters}</div>}
        <div className="flex-1" />
        {actions}
      </div>

      {children}

      {footer}
    </>
  );
}

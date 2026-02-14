"use client";

import { useState } from "react";
import { Card, CardContent } from "@wine-club/ui";
import { FilterPillFromConfig } from "./filter-popover";
import type { FilterConfig } from "./use-data-table";

// ---------------------------------------------------------------------------
// Column definition
// ---------------------------------------------------------------------------

export interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  headerClassName?: string;
  cellClassName?: string;
  render: (item: T) => React.ReactNode;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DataTableProps<T> {
  /** Page title shown in the sticky header */
  title: string;
  /** Column definitions */
  columns: Column<T>[];
  /** Action buttons rendered on the right side of the header */
  actions?: React.ReactNode;

  // --- Data ---
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  /** Optional actions shown on row hover, fixed on the right */
  rowActions?: (item: T) => React.ReactNode;
  /** Filter function applied to each item */
  filterFn: (item: T, activeFilters: Record<string, string>) => boolean;

  // --- Filter state (from useDataTable) ---
  filterConfigs: FilterConfig[];
  filterValues: Record<string, string>;
  inputValues: Record<string, string>;
  openFilter: string | null;
  toggleFilter: (key: string) => void;
  applyTextFilter: (key: string) => void;
  applySelectFilter: (key: string, value: string) => void;
  clearFilter: (key: string) => void;
  setInput: (key: string, value: string) => void;

  // --- Pagination (from useDataTable) ---
  page: number;
  setPage: (page: number | ((p: number) => number)) => void;

  // --- Empty states ---
  emptyMessage: string;
  filteredEmptyMessage: string;
}

// ---------------------------------------------------------------------------
// Footer (separate component to guarantee re-render on count change)
// ---------------------------------------------------------------------------

function DataTableFooter({
  count,
  page,
  totalPages,
  setPage,
}: {
  count: number;
  page: number;
  totalPages: number;
  setPage: (page: number | ((p: number) => number)) => void;
}) {
  return (
    <div
      key={count}
      className="sticky bottom-0 -mx-3 px-3 mt-3 flex items-center justify-between h-10 border-t border-neutral-400 bg-neutral-50 text-xs text-muted-foreground"
    >
      <span>
        {`${count} ${count === 1 ? "result" : "results"}`}
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p: number) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-2 h-7 rounded-md border border-neutral-500 bg-white text-neutral-950 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:border-neutral-700 transition-colors"
          >
            Previous
          </button>
          <span>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p: number) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-2 h-7 rounded-md border border-neutral-500 bg-white text-neutral-950 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:border-neutral-700 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 100;

export function DataTable<T>({
  title,
  columns,
  actions,
  data,
  keyExtractor,
  onRowClick,
  rowActions,
  filterFn,
  filterConfigs,
  filterValues,
  inputValues,
  openFilter,
  toggleFilter,
  applyTextFilter,
  applySelectFilter,
  clearFilter,
  setInput,
  page,
  setPage,
  emptyMessage,
  filteredEmptyMessage,
}: DataTableProps<T>) {
  // Compute filtered/paginated directly from data + filterValues
  const activeFilters: Record<string, string> = {};
  for (const [k, v] of Object.entries(filterValues)) {
    if (v) activeFilters[k] = v;
  }
  const hasActiveFilters = Object.keys(activeFilters).length > 0;
  const filtered = hasActiveFilters
    ? data.filter((item) => filterFn(item, activeFilters))
    : data;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      {/* Sticky header: title + filters + actions */}
      <div className="sticky top-0 z-10 -mx-3 px-3 pt-3 flex items-center gap-2 pb-3 mb-3 border-b border-neutral-400 bg-neutral-50">
        <h1 className="text-sm font-semibold text-foreground w-[120px] shrink-0">{title}</h1>
        <div className="flex items-center gap-1">
          {filterConfigs.map((config) => (
            <FilterPillFromConfig
              key={config.key}
              config={config}
              value={filterValues[config.key] || ""}
              inputValue={inputValues[config.key] || ""}
              isOpen={openFilter === config.key}
              onToggle={() => {
                const v = filterValues[config.key];
                if (v) {
                  clearFilter(config.key);
                } else {
                  toggleFilter(config.key);
                }
              }}
              onApplyText={() => applyTextFilter(config.key)}
              onApplySelect={(value) => applySelectFilter(config.key, value)}
              onSetInput={(value) => setInput(config.key, value)}
            />
          ))}
        </div>

        <div className="flex-1" />

        {actions}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {data.length === 0 ? emptyMessage : filteredEmptyMessage}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-none overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse">
                <thead className="border-b bg-neutral-50">
                  <tr className="text-left">
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        scope="col"
                        className={`px-3 h-[42px] align-middle font-medium text-sm text-muted-foreground ${
                          col.align === "right" ? "text-right" : ""
                        } ${col.headerClassName || ""}`}
                      >
                        {col.label}
                      </th>
                    ))}
                    {rowActions && (
                      <th scope="col" className="sticky right-0 z-10 w-[42px] min-w-[42px] shrink-0 bg-neutral-50 px-0" style={{ height: 42 }} />
                    )}
                  </tr>
                </thead>
                <tbody className="[&>tr]:shadow-[inset_0_-1px_0_0_rgb(229_231_235)] dark:[&>tr]:shadow-[inset_0_-1px_0_0_rgb(64_64_64)] [&>tr:last-child]:shadow-none">
                  {paginated.map((item) => (
                    <tr
                      key={keyExtractor(item)}
                      className={`hover:bg-muted/50 !h-[42px] ${rowActions ? "group" : ""} ${onRowClick ? "cursor-pointer" : ""}`}
                      style={{ height: 42, minHeight: 42, maxHeight: 42 }}
                      onClick={onRowClick ? () => onRowClick(item) : undefined}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`min-w-0 py-0 px-3 text-sm leading-none align-middle overflow-hidden ${
                            col.align === "right" ? "text-right" : ""
                          } ${col.cellClassName || ""}`}
                        >
                          <div className="min-w-0 max-h-[42px] leading-none truncate overflow-hidden">
                            {col.render(item)}
                          </div>
                        </td>
                      ))}
                      {rowActions && (
                        <td
                          className="sticky right-0 z-10 w-[42px] min-w-[42px] py-0 px-0 align-middle shrink-0 bg-card"
                          onClick={(e) => e.stopPropagation()}
                          style={{ height: 42 }}
                        >
                          <div className="relative flex h-[42px] w-[42px] items-center justify-center">
                            {rowActions(item)}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sticky footer: result count + pagination */}
      <DataTableFooter
        count={filtered.length}
        page={page}
        totalPages={totalPages}
        setPage={setPage}
      />
    </>
  );
}


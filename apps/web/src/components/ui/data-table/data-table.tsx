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
      className="sticky bottom-0 -mx-3 px-3 mt-3 flex items-center justify-between h-10 border-t border-[#eaeaea] bg-[#fafafa] text-xs text-muted-foreground"
    >
      <span>
        {`${count} ${count === 1 ? "result" : "results"}`}
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p: number) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-2 h-7 rounded-md border border-[#e0e0e0] bg-white text-[#171717] text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#ccc] transition-colors"
          >
            Previous
          </button>
          <span>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p: number) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-2 h-7 rounded-md border border-[#e0e0e0] bg-white text-[#171717] text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#ccc] transition-colors"
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
      <div className="sticky top-0 z-10 -mx-3 px-3 pt-3 flex items-center gap-2 pb-3 mb-3 border-b border-[#eaeaea] bg-[#fafafa]">
        <h1 className="text-sm font-medium text-foreground w-[120px] shrink-0">{title}</h1>
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
              <table className="w-full">
                <thead className="border-b bg-[#fafafa]">
                  <tr className="text-left">
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        className={`px-3 h-[42px] font-medium text-sm text-muted-foreground ${
                          col.align === "right" ? "text-right" : ""
                        } ${col.headerClassName || ""}`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginated.map((item) => (
                    <tr
                      key={keyExtractor(item)}
                      className={`hover:bg-muted/50 ${onRowClick ? "cursor-pointer" : ""}`}
                      onClick={onRowClick ? () => onRowClick(item) : undefined}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-3 py-2.5 text-sm align-middle ${
                            col.align === "right" ? "text-right" : ""
                          } ${col.cellClassName || ""}`}
                        >
                          {col.render(item)}
                        </td>
                      ))}
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


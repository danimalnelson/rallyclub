"use client";

import { Button, Card, CardContent } from "@wine-club/ui";
import { FilterPillFromConfig } from "./filter-popover";
import type { UseDataTableReturn } from "./use-data-table";

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
  /** Full (unfiltered) data array — used only for empty-state detection */
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  /** Optional actions shown on row hover, fixed on the right */
  rowActions?: (item: T) => React.ReactNode;

  // --- Table state (from useDataTable) ---
  table: UseDataTableReturn<T>;

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
      className="sticky bottom-0 -mx-3 px-3 mt-3 flex items-center justify-between h-10 border-t border-gray-300 dark:border-gray-600 bg-ds-background-200 dark:bg-gray-100 text-xs text-gray-600 dark:text-gray-800"
    >
      <span>
        {`${count} ${count === 1 ? "result" : "results"}`}
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="small"
            onClick={() => setPage((p: number) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-2 h-7 text-xs"
          >
            Previous
          </Button>
          <span>
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="secondary"
            size="small"
            onClick={() => setPage((p: number) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-2 h-7 text-xs"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataTable<T>({
  title,
  columns,
  actions,
  data,
  keyExtractor,
  onRowClick,
  rowActions,
  table,
  emptyMessage,
  filteredEmptyMessage,
}: DataTableProps<T>) {
  const {
    filterConfigs,
    filterValues,
    inputValues,
    openFilter,
    toggleFilter,
    applyTextFilter,
    applySelectFilter,
    clearFilter,
    setInput,
    filtered,
    paginated,
    page,
    setPage,
    totalPages,
  } = table;

  return (
    <>
      {/* Sticky header: title + filters + actions */}
      <div className="sticky top-0 z-10 -mx-3 px-3 pt-3 flex items-center gap-2 pb-3 mb-3 border-b border-gray-300 dark:border-gray-600 bg-ds-background-200 dark:bg-gray-100">
        <h1 className="text-sm font-semibold text-gray-950 dark:text-white w-[120px] shrink-0">{title}</h1>
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
            <p className="text-gray-600 dark:text-gray-800">
              {data.length === 0 ? emptyMessage : filteredEmptyMessage}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-none overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse">
                <thead className="border-b border-gray-200 dark:border-gray-700 bg-ds-background-200 dark:bg-gray-100">
                  <tr className="text-left">
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        scope="col"
                        className={`px-3 h-[42px] align-middle font-medium text-sm text-gray-800 dark:text-gray-800 ${
                          col.align === "right" ? "text-right" : ""
                        } ${col.headerClassName || ""}`}
                      >
                        {col.label}
                      </th>
                    ))}
                    {rowActions && (
                      <th scope="col" className="sticky right-0 z-10 w-[42px] min-w-[42px] shrink-0 bg-ds-background-200 dark:bg-gray-100 px-0" style={{ height: 42 }} />
                    )}
                  </tr>
                </thead>
                <tbody className="[&>tr]:border-b [&>tr]:border-gray-200 dark:[&>tr]:border-gray-700 [&>tr:last-child]:border-b-0">
                  {paginated.map((item) => (
                    <tr
                      key={keyExtractor(item)}
                      className={`!h-[42px] ${rowActions ? "group" : ""} ${onRowClick ? "cursor-pointer" : ""}`}
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
                          className="sticky right-0 z-10 w-[42px] min-w-[42px] py-0 px-0 align-middle shrink-0 bg-white dark:bg-gray-100"
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

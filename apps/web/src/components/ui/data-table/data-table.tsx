"use client";

import { Card, CardContent } from "@wine-club/ui";
import { FilterPill } from "./filter-pill";
import type { FilterConfig, TextFilterConfig, SelectFilterConfig } from "./use-data-table";

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

  // --- Data (from useDataTable) ---
  data: T[];
  filtered: T[];
  paginated: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;

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
  totalPages: number;

  // --- Empty states ---
  emptyMessage: string;
  filteredEmptyMessage: string;
  /** Label for the result count (e.g., "result", "member") */
  resultLabel: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataTable<T>({
  title,
  columns,
  actions,
  data,
  filtered,
  paginated,
  keyExtractor,
  onRowClick,
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
  totalPages,
  emptyMessage,
  filteredEmptyMessage,
  resultLabel,
}: DataTableProps<T>) {
  return (
    <>
      {/* Sticky header: title + filters + actions */}
      <div className="sticky top-0 z-10 -mx-3 px-3 flex items-center gap-2 pb-3 mb-3 border-b border-[#eaeaea] bg-[#fafafa]">
        <h1 className="text-sm font-medium text-foreground w-[120px] shrink-0">{title}</h1>
        <div className="flex items-center gap-1.5">
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
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {data.length === 0 ? emptyMessage : filteredEmptyMessage}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr className="text-left">
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        className={`px-3 h-[42px] font-medium text-xs text-muted-foreground ${
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
                      className={`hover:bg-muted/50 h-[42px] ${onRowClick ? "cursor-pointer" : ""}`}
                      onClick={onRowClick ? () => onRowClick(item) : undefined}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-3 text-sm ${
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
      <div className="sticky bottom-0 -mx-3 px-3 mt-3 flex items-center justify-between h-10 border-t border-[#eaeaea] bg-[#fafafa] text-xs text-muted-foreground">
        <span>
          {filtered.length} {resultLabel}
          {filtered.length !== 1 ? "s" : ""}
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
    </>
  );
}

// ---------------------------------------------------------------------------
// Internal: render the right filter pill UI based on config type
// ---------------------------------------------------------------------------

function FilterPillFromConfig({
  config,
  value,
  inputValue,
  isOpen,
  onToggle,
  onApplyText,
  onApplySelect,
  onSetInput,
}: {
  config: FilterConfig;
  value: string;
  inputValue: string;
  isOpen: boolean;
  onToggle: () => void;
  onApplyText: () => void;
  onApplySelect: (value: string) => void;
  onSetInput: (value: string) => void;
}) {
  const active = !!value;

  if (config.type === "text") {
    const textConfig = config as TextFilterConfig;
    const activeLabel = active
      ? textConfig.formatActive
        ? textConfig.formatActive(value)
        : `${config.label}: ${value}`
      : config.label;

    return (
      <FilterPill label={activeLabel} active={active} onToggle={onToggle} isOpen={isOpen}>
        <div className="p-3 w-64">
          <p className="text-sm font-semibold text-[#171717] mb-2">Filter by {config.label.toLowerCase()}</p>
          <input
            type="text"
            placeholder={textConfig.placeholder || "contains..."}
            maxLength={textConfig.maxLength}
            value={inputValue}
            onChange={(e) => {
              const v = textConfig.inputTransform ? textConfig.inputTransform(e.target.value) : e.target.value;
              onSetInput(v);
            }}
            onKeyDown={(e) => e.key === "Enter" && onApplyText()}
            autoFocus
            className="w-full px-3 py-2 text-sm border border-[#e0e0e0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#171717] focus:border-transparent"
          />
          <button
            onClick={onApplyText}
            className="w-full mt-2 px-3 py-2 text-sm font-medium text-white bg-[#171717] rounded-md hover:bg-black transition-colors"
          >
            Apply
          </button>
        </div>
      </FilterPill>
    );
  }

  // Select filter
  const selectConfig = config as SelectFilterConfig;
  const activeLabel = active
    ? selectConfig.formatActive
      ? selectConfig.formatActive(value)
      : `${config.label}: ${selectConfig.options.find((o) => o.value === value)?.label || value}`
    : config.label;

  return (
    <FilterPill label={activeLabel} active={active} onToggle={onToggle} isOpen={isOpen}>
      <div className="w-52">
        <p className="px-3 pt-3 pb-1 text-sm font-semibold text-[#171717]">Filter by {config.label.toLowerCase()}</p>
        {selectConfig.options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onApplySelect(opt.value)}
            className="w-full text-left px-3 py-2 text-sm text-[#444] hover:bg-[#f5f5f5] transition-colors"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </FilterPill>
  );
}

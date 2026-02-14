"use client";

import * as React from "react";
import { cn } from "@wine-club/ui";
import { ChevronDown, ChevronUp } from "geist-icons";
import { EmptyState } from "../empty-state";

export type RowHeightPreset = "compact" | "comfortable" | "spacious";

const ROW_HEIGHT_MAP: Record<RowHeightPreset, string> = {
  compact: "h-[42px]",
  comfortable: "h-[56px]",
  spacious: "h-[72px]",
};

export interface ListColumn<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  headerClassName?: string;
  cellClassName?: string;
  /** Enable sortable header for this column */
  sortable?: boolean;
  render: (item: T) => React.ReactNode;
}

export interface SortState {
  key: string;
  direction: "asc" | "desc";
}

interface ListPropsBase<T> {
  columns: ListColumn<T>[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
  emptyDescription?: React.ReactNode;
  variableRowHeight?: boolean;
  rowHeight?: RowHeightPreset | number;
  headerHeight?: RowHeightPreset | number;
  sortState?: SortState;
  onSort?: (key: string) => void;
  footer?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  rowClassName?: string;
  cellClassName?: string;
}

interface ListPropsFlat<T> extends ListPropsBase<T> {
  items: T[];
  onRowClick?: (item: T) => void;
}

export interface ListGroup<G, T> {
  key: string;
  group: G;
  items: T[];
}

interface ListPropsGrouped<G, T> extends ListPropsBase<T> {
  groups: ListGroup<G, T>[];
  renderGroupHeader: (group: G) => React.ReactNode;
  onGroupClick?: (group: G) => void;
  onRowClick?: (item: T) => void;
  /** Show column header row for child items (default: true) */
  showGroupHeader?: boolean;
  groupRowClassName?: string;
  childRowClassName?: string;
}

function resolveHeight(
  value: RowHeightPreset | number | undefined,
  preset: RowHeightPreset
): { className?: string; style?: React.CSSProperties } {
  if (value === undefined) return { className: ROW_HEIGHT_MAP[preset] };
  if (typeof value === "number") return { style: { height: value } };
  return { className: ROW_HEIGHT_MAP[value] };
}

function renderTableHeader<T>({
  columns,
  sortState,
  onSort,
  headerHeightRes,
  headerClassNameProp,
}: {
  columns: ListColumn<T>[];
  sortState?: SortState;
  onSort?: (key: string) => void;
  headerHeightRes: { className?: string; style?: React.CSSProperties };
  headerClassNameProp?: string;
}) {
  return (
    <thead className={cn("border-b border-neutral-400 bg-neutral-50", headerClassNameProp)}>
      <tr className="text-left">
        {columns.map((col) => {
          const isSorted = sortState?.key === col.key;
          const canSort = col.sortable && onSort;

          return (
            <th
              key={col.key}
              scope="col"
              className={cn(
                "px-3 align-middle font-medium text-sm text-muted-foreground",
                headerHeightRes.className,
                col.align === "right" && "text-right",
                canSort && "cursor-pointer select-none hover:text-foreground",
                col.headerClassName
              )}
              style={headerHeightRes.style}
              onClick={canSort ? () => onSort!(col.key) : undefined}
            >
              <div className="flex items-center gap-1">
                <span>{col.label}</span>
                {canSort && isSorted &&
                  (sortState!.direction === "asc" ? (
                    <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                  ))}
              </div>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

/**
 * Configurable list/table component. Use standalone or inside ListView.
 * Supports flat lists, grouped/nested rows, row height, sorting, and style overrides.
 */
export function List<T, G = undefined>(
  props: ListPropsFlat<T> | ListPropsGrouped<G, T>
) {
  const {
    columns,
    keyExtractor,
    emptyMessage,
    emptyDescription,
    variableRowHeight = false,
    rowHeight = "compact",
    headerHeight = "compact",
    sortState,
    onSort,
    footer,
    className,
    headerClassName: headerClassNameProp,
    rowClassName: rowClassNameProp,
    cellClassName: cellClassNameProp,
  } = props;

  const headerHeightRes = resolveHeight(headerHeight, "compact");
  const rowHeightRes = variableRowHeight
    ? { className: "min-h-[42px] py-3" }
    : resolveHeight(rowHeight, "compact");

  const isGrouped = "groups" in props && props.groups;

  if (isGrouped) {
    const {
      groups,
      renderGroupHeader,
      onGroupClick,
      onRowClick,
      showGroupHeader = true,
      groupRowClassName,
      childRowClassName,
    } = props as ListPropsGrouped<G, T>;

    const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);

    if (totalItems === 0 && groups.length === 0 && emptyMessage) {
      return (
        <div className={cn("rounded-lg border bg-card py-12 text-center", className)}>
          <EmptyState message={emptyMessage} description={emptyDescription} />
        </div>
      );
    }

    if (groups.length === 0) {
      return null;
    }

    const childRowCn = cn(
      rowHeightRes.className,
      "hover:bg-muted/50 border-b transition-colors",
      onRowClick && "cursor-pointer",
      childRowClassName ?? rowClassNameProp
    );

    const groupRowCn = cn(
      "h-[42px] bg-white border-b cursor-pointer hover:bg-neutral-100 active:bg-neutral-200 transition-colors",
      groupRowClassName
    );

    return (
      <div className={cn("overflow-hidden rounded-lg border bg-card", className)}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            {showGroupHeader && renderTableHeader({
              columns,
              sortState,
              onSort,
              headerHeightRes,
              headerClassNameProp,
            })}
            <tbody className="[&>tr:last-child]:border-b-0">
              {groups.map(({ key, group, items }) => (
                <React.Fragment key={key}>
                  <tr
                    className={groupRowCn}
                    onClick={onGroupClick ? () => onGroupClick(group) : undefined}
                  >
                    <td colSpan={columns.length} className="px-3">
                      {renderGroupHeader(group)}
                    </td>
                  </tr>
                  {items.map((item) => (
                    <tr
                      key={keyExtractor(item)}
                      className={childRowCn}
                      style={rowHeightRes.style}
                      onClick={onRowClick ? () => onRowClick(item) : undefined}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            "px-3 text-sm align-middle",
                            col.align === "right" && "text-right",
                            col.cellClassName,
                            cellClassNameProp
                          )}
                        >
                          {col.render(item)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {footer}
      </div>
    );
  }

  // Flat mode
  const { items, onRowClick } = props as ListPropsFlat<T>;

  if (items.length === 0 && emptyMessage) {
    return (
      <div className={cn("rounded-lg border bg-card py-12 text-center", className)}>
        <EmptyState message={emptyMessage} description={emptyDescription} />
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  const rowClassName = cn(
    rowHeightRes.className,
    "hover:bg-muted/50",
    onRowClick && "cursor-pointer",
    rowClassNameProp
  );

  return (
    <div className={cn("overflow-hidden rounded-lg border bg-card", className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          {renderTableHeader({
            columns,
            sortState,
            onSort,
            headerHeightRes,
            headerClassNameProp,
          })}
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {items.map((item) => (
              <tr
                key={keyExtractor(item)}
                className={rowClassName}
                style={rowHeightRes.style}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-3 text-sm align-middle",
                      col.align === "right" && "text-right",
                      col.cellClassName,
                      cellClassNameProp
                    )}
                  >
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}

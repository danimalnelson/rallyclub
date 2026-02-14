# List & ListView Component Audit

## Current State

### Components in Use

| Component | Location | Purpose | Used By |
|-----------|----------|---------|---------|
| **DataTable** | `data-table/data-table.tsx` | Full-page table: header bar (title + filters + actions), table body, footer (pagination) | MembersTable, TransactionTable |
| **TableView** | `data-table/table-view.tsx` | Table only: header row + data rows, columns | DataTable, ActiveSubscriptionsTable |
| **DataView** | `data-view.tsx` | Simple list: spaced or divided items via `renderItem` | ActivityFeed |
| **FilterPillFromConfig** | `data-table/filter-popover.tsx` | Filter pills driven by config | DataTable (via MembersTable, TransactionTable) |
| **useDataTable** | `data-table/use-data-table.ts` | Filter state, pagination | MembersTable, TransactionTable, PlansAndMembershipsTable |

### Page/View Usage

| Page | Component | Structure |
|------|-----------|-----------|
| **Members** | MembersTable → DataTable | Header (title, filters, actions) + TableView + Footer |
| **Transactions** | TransactionTable → DataTable | Same as Members |
| **Plans** | PlansAndMembershipsTable | Custom: header + filters, but **grouped cards** (membership sections, not a flat table). Uses useDataTable but custom layout. |
| **Dashboard Activity** | ActivityFeed | Card with title + "View all" + DataView (spaced list of custom rows) |
| **Member Detail** | ActiveSubscriptionsTable | SectionCard + TableView only (no header bar, no filters) |

### What's Hardcoded Today

- **Row height**: `h-[42px]` in TableView (or `min-h-[42px] py-3` for variable)
- **Header row height**: `h-[42px]` in TableView
- **Cell padding**: `px-3` everywhere
- **Filter styling**: FilterPill, FilterPillFromConfig – not configurable from parent
- **Column sorting**: Not implemented
- **Footer**: DataTableFooter is inline in DataTable – pagination UI is fixed

---

## Proposed Architecture

### Hierarchy

```
ListView (page-level)
├── Header bar: title, filters, actions
├── List (or children)
│   ├── Header row
│   ├── Data rows
│   └── Empty state
└── Footer: pagination, result count (optional)
```

- **ListView** = Page chrome. Does not own row/column semantics.
- **List** = Table/list body. Owns rows, columns, header. Configurable at component level.

### 1. List Component

**Purpose**: The table/list body. Used standalone (Active Subscriptions) or inside ListView (Members, Transactions).

**Configurable props**:
- `rowHeight`: `"compact" | "comfortable" | "spacious"` or `number` (default: `"compact"` = 42px)
- `headerHeight`: optional override
- `columns`: column defs, each with optional `sortable?: boolean`, `onSort?: () => void`
- `sortState?: { key: string; direction: "asc" | "desc" }`
- `variableRowHeight`: for multi-line content
- `headerClassName`, `rowClassName`, `cellClassName`: styling overrides
- `emptyMessage`, `emptyDescription`, `onRowClick`

**Exports**: `List`, `ListColumn` (or reuse `Column`/`TableColumn`)

### 2. ListView Component

**Purpose**: Page-level wrapper. Title, filters, actions, slot for list, optional footer.

**Props**:
- `title`: string
- `filters?`: ReactNode (or `filterConfigs` + filter state for default pills)
- `actions?`: ReactNode
- `children`: the List (or any content)
- `footer?`: ReactNode (pagination, result count)
- `emptyMessage?`, `filteredEmptyMessage?`: when list is empty (can delegate to List)

**Structure**:
```
<div className={PAGE_HEADER_BAR_CLASSES}>
  <h1>{title}</h1>
  {filters}
  <div className="flex-1" />
  {actions}
</div>
{children}
{footer}
```

### 3. Usage

| Consumer | Uses | Notes |
|----------|------|-------|
| MembersTable | ListView + List | ListView provides header, filters, actions, footer. List provides table. |
| TransactionTable | ListView + List | Same pattern. |
| ActivityFeed | Unchanged or ListView + List | Activity uses card-style rows (DataView), not a columnar table. Could use ListView for title + "View all" and keep DataView, or introduce a List variant for card-style. |
| ActiveSubscriptionsTable | List only | SectionCard + List. No ListView. |
| PlansAndMembershipsTable | Custom for now | Grouped layout is different; could adopt ListView for header/filters later. |

### 4. Filter Customization

To change "how filters look" at the component level:
- ListView accepts `filters` as ReactNode.
- Default: `filters={<FilterPillsFromConfig configs={...} ... />}` 
- Custom: pass any filter UI as `filters={...}`.
- Filter state stays in the consumer (e.g. useDataTable) or a shared hook.

### 5. Migration Path

1. **Extract List** from TableView: add `rowHeight`, `headerHeight`, `sortState`, `sortable` columns, class overrides.
2. **Create ListView**: header bar + children + optional footer.
3. **Refactor DataTable** into: `ListView` + `List` + `useDataTable` (or equivalent).
4. **MembersTable, TransactionTable**: Use ListView + List instead of DataTable.
5. **ActiveSubscriptionsTable**: Use List instead of TableView.
6. **ActivityFeed**: Optionally wrap in ListView for title + "View all"; keep DataView for the list content.
7. **PlansAndMembershipsTable**: Optionally adopt ListView for header/filters; keep custom body.

---

## File Structure (Proposed)

```
apps/web/src/components/ui/
├── list/
│   ├── list.tsx           # List component (table body)
│   ├── list-view.tsx      # ListView (page wrapper)
│   └── index.ts
├── data-table/            # Keep for filter pills, useDataTable
│   ├── filter-pill.tsx
│   ├── filter-popover.tsx
│   ├── use-data-table.ts
│   └── ...
└── empty-state.tsx
```

Or keep under `data-table/`:
- `list.tsx` (List)
- `list-view.tsx` (ListView)
- `data-table.tsx` → becomes a composition of ListView + List + useDataTable for backward compatibility during migration.

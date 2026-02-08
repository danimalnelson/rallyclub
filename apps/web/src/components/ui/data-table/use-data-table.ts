"use client";

import { useState, useMemo, useCallback } from "react";

export interface TextFilterConfig {
  type: "text";
  key: string;
  label: string;
  placeholder?: string;
  maxLength?: number;
  /** Transform input (e.g., strip non-digits) */
  inputTransform?: (value: string) => string;
  /** Format the active pill label (e.g., "Card: ••4242") */
  formatActive?: (value: string) => string;
}

export interface SelectFilterConfig {
  type: "select";
  key: string;
  label: string;
  options: { value: string; label: string }[];
  /** Format the active pill label */
  formatActive?: (value: string) => string;
}

export type FilterConfig = TextFilterConfig | SelectFilterConfig;

const PAGE_SIZE = 100;

export function useDataTable<T>({
  data,
  filters: filterConfigs,
  filterFn,
}: {
  data: T[];
  filters: FilterConfig[];
  filterFn: (item: T, activeFilters: Record<string, string>) => boolean;
}) {
  // Committed filter values — empty string means inactive
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of filterConfigs) {
      initial[f.key] = "";
    }
    return initial;
  });

  // Text input drafts (not yet committed)
  const [inputValues, setInputValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of filterConfigs) {
      if (f.type === "text") initial[f.key] = "";
    }
    return initial;
  });

  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // Toggle a filter dropdown open/closed
  const toggleFilter = useCallback((key: string) => {
    setOpenFilter((prev) => (prev === key ? null : key));
  }, []);

  // Apply a text filter (commit input to filter)
  const applyTextFilter = useCallback((key: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: inputValues[key] || "" }));
    setPage(0);
    setOpenFilter(null);
  }, [inputValues]);

  // Apply a select filter (commit value directly)
  const applySelectFilter = useCallback((key: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
    setPage(0);
    setOpenFilter(null);
  }, []);

  // Clear a filter
  const clearFilter = useCallback((key: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: "" }));
    setInputValues((prev) => ({ ...prev, [key]: "" }));
    setPage(0);
    setOpenFilter(null);
  }, []);

  // Update a text input draft
  const setInput = useCallback((key: string, value: string) => {
    setInputValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Build active filters object (only non-empty values)
  const activeFilters = useMemo(() => {
    const active: Record<string, string> = {};
    for (const [k, v] of Object.entries(filterValues)) {
      if (v) active[k] = v;
    }
    return active;
  }, [filterValues]);

  // Filter data
  const filtered = useMemo(() => {
    if (Object.keys(activeFilters).length === 0) return data;
    return data.filter((item) => filterFn(item, activeFilters));
  }, [data, activeFilters, filterFn]);

  // Paginate
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page]
  );

  return {
    // Filter state
    filterValues,
    inputValues,
    openFilter,
    toggleFilter,
    applyTextFilter,
    applySelectFilter,
    clearFilter,
    setInput,
    // Data
    filtered,
    paginated,
    // Pagination
    page,
    setPage,
    totalPages,
    pageSize: PAGE_SIZE,
  };
}

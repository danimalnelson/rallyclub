"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@wine-club/ui";
import { Check } from "geist-icons";
import { FilterPill } from "./filter-pill";
import type { FilterConfig, TextFilterConfig, SelectFilterConfig } from "./use-data-table";

// ---------------------------------------------------------------------------
// Delayed-focus input — focuses after a brief delay so the ring animates in
// ---------------------------------------------------------------------------

function DelayedFocusInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      {...props}
      className="w-full px-3 py-2 text-sm border rounded-md outline-none ring-0 ring-neutral-950/0 focus:ring-2 focus:ring-neutral-950/20 focus:border-neutral-800 transition-all duration-1000"
    />
  );
}

// ---------------------------------------------------------------------------
// Shared filter popover components
// ---------------------------------------------------------------------------

export function FilterPillFromConfig({
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
    const displayValue = active
      ? textConfig.formatActive
        ? textConfig.formatActive(value)
        : value
      : undefined;

    return (
      <FilterPill label={config.label} activeValue={displayValue} active={active} onToggle={onToggle} isOpen={isOpen}>
        <div className="w-[240px] overflow-y-auto">
          <div className="p-3">
            <p className="text-sm font-medium text-neutral-950 mb-2">Filter by: {config.label.toLowerCase()}</p>
            <DelayedFocusInput
              placeholder={textConfig.placeholder || "contains..."}
              maxLength={textConfig.maxLength}
              value={inputValue}
              onChange={(e) => {
                const v = textConfig.inputTransform ? textConfig.inputTransform(e.target.value) : e.target.value;
                onSetInput(v);
              }}
              onKeyDown={(e) => e.key === "Enter" && onApplyText()}
            />
          </div>
          <div className="p-3 border-t border-neutral-400">
            <Button
              className="w-full"
              onClick={onApplyText}
            >
              Apply
            </Button>
          </div>
        </div>
      </FilterPill>
    );
  }

  // Multi-select filter
  return (
    <MultiSelectFilterPill
      config={config as SelectFilterConfig}
      value={value}
      active={active}
      isOpen={isOpen}
      onToggle={onToggle}
      onApplySelect={onApplySelect}
    />
  );
}

function MultiSelectFilterPill({
  config,
  value,
  active,
  isOpen,
  onToggle,
  onApplySelect,
}: {
  config: SelectFilterConfig;
  value: string;
  active: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onApplySelect: (value: string) => void;
}) {
  const selectedValues = value ? value.split(",") : [];
  const [pending, setPending] = useState<Set<string>>(new Set(selectedValues));

  // Sync pending state whenever committed value changes (e.g. filter cleared)
  // or when the dropdown opens (to reset uncommitted selections)
  useEffect(() => {
    setPending(new Set(value ? value.split(",") : []));
  }, [isOpen, value]);

  const toggleOption = (optValue: string) => {
    setPending((prev) => {
      const next = new Set(prev);
      if (next.has(optValue)) {
        next.delete(optValue);
      } else {
        next.add(optValue);
      }
      return next;
    });
  };

  const applySelection = () => {
    onApplySelect(Array.from(pending).join(","));
  };

  // Build display value for the pill
  const displayValue = active
    ? config.formatActive
      ? config.formatActive(value)
      : selectedValues
          .map((v) => config.options.find((o) => o.value === v)?.label || v)
          .join(", ")
    : undefined;

  return (
    <FilterPill label={config.label} activeValue={displayValue} active={active} onToggle={onToggle} isOpen={isOpen}>
      <div className="w-[240px] flex flex-col">
        <p className="px-3 pt-3 pb-2 text-sm font-medium text-neutral-950 shrink-0">Filter by: {config.label.toLowerCase()}</p>
        <div className="overflow-y-auto px-2 pb-3 min-h-0">
          <div className="flex flex-col gap-0.5">
            {config.options.map((opt) => {
              const checked = pending.has(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleOption(opt.value)}
                  className="flex items-center gap-2.5 px-2 h-9 rounded-md text-sm font-medium text-neutral-900 hover:text-neutral-950 hover:bg-neutral-100 transition-colors"
                >
                  <span
                    className={`flex items-center justify-center h-4 w-4 rounded border transition-colors shrink-0 ${
                      checked
                        ? "bg-neutral-950 border-neutral-950"
                        : "border-neutral-600 bg-white"
                    }`}
                  >
                    {checked && <Check className="h-3 w-3 text-white" />}
                  </span>
                  {opt.icon ? (
                    <span className="flex items-center gap-1.5">
                      <span className="shrink-0">{opt.icon}</span>
                      {opt.label}
                    </span>
                  ) : (
                    opt.label
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="p-3 border-t border-neutral-400 shrink-0">
          <Button
            className="w-full"
            onClick={applySelection}
          >
            Apply
          </Button>
        </div>
      </div>
    </FilterPill>
  );
}

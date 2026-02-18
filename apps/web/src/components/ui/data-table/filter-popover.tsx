"use client";

import { useEffect, useRef } from "react";
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
      className="w-full px-3 py-2 text-sm border rounded-md outline-none ring-0 ring-gray-950/0 focus:ring-2 focus:ring-gray-950/20 focus:border-gray-800 transition-all duration-1000"
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
      <FilterPill
        label={config.label}
        activeValue={displayValue}
        active={active}
        onToggle={onToggle}
        isOpen={isOpen}
      >
        <div>
          <DelayedFocusInput
            placeholder={textConfig.placeholder || "contains..."}
            maxLength={textConfig.maxLength}
            value={inputValue}
            onChange={(e) => {
              const v = textConfig.inputTransform ? textConfig.inputTransform(e.target.value) : e.target.value;
              onSetInput(v);
            }}
          />
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

  const toggleOption = (optValue: string) => {
    const current = new Set(selectedValues);
    if (current.has(optValue)) {
      current.delete(optValue);
    } else {
      current.add(optValue);
    }
    onApplySelect(Array.from(current).join(","));
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
    <FilterPill
      label={config.label}
      activeValue={displayValue}
      active={active}
      onToggle={onToggle}
      isOpen={isOpen}
    >
      <div className="min-h-0">
        <div className="flex flex-col gap-0.5">
          {config.options.map((opt) => {
            const checked = selectedValues.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggleOption(opt.value)}
                className="flex items-center gap-2.5 px-2 h-9 rounded-md text-sm font-medium text-gray-900 hover:text-gray-950 hover:bg-gray-100 transition-colors"
              >
                <span
                  className={`flex items-center justify-center h-4 w-4 rounded border transition-colors shrink-0 ${
                    checked
                      ? "bg-gray-950 border-gray-950"
                      : "border-gray-600 bg-white dark:bg-gray-100"
                  }`}
                >
                  {checked && <Check className="h-3 w-3" style={{ color: "white" }} />}
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
    </FilterPill>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { MenuContainer, Menu, useMenuContext, Button } from "@wine-club/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isInRange(day: Date, from: Date | null, to: Date | null) {
  if (!from || !to) return false;
  const d = startOfDay(day).getTime();
  return d >= startOfDay(from).getTime() && d <= startOfDay(to).getTime();
}

function formatLabel(range: DateRange): string | null {
  if (!range.from && !range.to) return null;
  const fmt = (d: Date) => `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
  if (range.from && range.to) {
    if (isSameDay(range.from, range.to)) return fmt(range.from);
    return `${fmt(range.from)} – ${fmt(range.to)}`;
  }
  if (range.from) return `From ${fmt(range.from)}`;
  return `To ${fmt(range.to!)}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

type PresetKey = "today" | "7d" | "30d" | "90d" | "thisMonth" | "lastMonth";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "thisMonth", label: "This month" },
  { key: "lastMonth", label: "Last month" },
];

function getPresetRange(key: PresetKey): DateRange {
  const now = new Date();
  const today = startOfDay(now);
  switch (key) {
    case "today":
      return { from: today, to: endOfDay(now) };
    case "7d":
      return { from: new Date(today.getTime() - 6 * 86400000), to: endOfDay(now) };
    case "30d":
      return { from: new Date(today.getTime() - 29 * 86400000), to: endOfDay(now) };
    case "90d":
      return { from: new Date(today.getTime() - 89 * 86400000), to: endOfDay(now) };
    case "thisMonth":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
    case "lastMonth": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: first, to: endOfDay(last) };
    }
  }
}

// ---------------------------------------------------------------------------
// Pill trigger (uses MenuContext)
// ---------------------------------------------------------------------------

function DateRangeTrigger({ label, active, onClear }: { label: string | null; active: boolean; onClear: () => void }) {
  const { isOpen, toggle, triggerRef } = useMenuContext();

  const [showActive, setShowActive] = useState(false);
  useEffect(() => {
    if (active) {
      const t = requestAnimationFrame(() => setShowActive(true));
      return () => cancelAnimationFrame(t);
    }
    setShowActive(false);
  }, [active]);

  return (
    <button
      ref={triggerRef}
      onClick={active ? onClear : toggle}
      aria-expanded={isOpen}
      aria-haspopup="dialog"
      className={`group inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium border transition-all duration-300 ${
        showActive
          ? "bg-gray-950 text-white border-gray-950 dark:bg-white dark:text-gray-950 dark:border-white"
          : "bg-white text-gray-950 border-gray-300 hover:bg-[--ds-gray-100] hover:border-gray-500 dark:border-gray-600 dark:bg-gray-100 dark:text-white dark:hover:border-gray-400"
      }`}
    >
      <span>Date</span>
      {active && label && (
        <>
          <span className="opacity-40">|</span>
          <span className="font-semibold">{label}</span>
        </>
      )}
      {showActive ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
          <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Calendar grid
// ---------------------------------------------------------------------------

function CalendarMonth({
  year,
  month,
  selecting,
  hoverDate,
  onDayClick,
  onDayHover,
}: {
  year: number;
  month: number;
  selecting: DateRange;
  hoverDate: Date | null;
  onDayClick: (d: Date) => void;
  onDayHover: (d: Date | null) => void;
}) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const today = startOfDay(new Date());

  const rangeEnd = selecting.to || hoverDate;

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-gray-500 h-6 leading-6">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="h-7" />;

          const isToday = isSameDay(day, today);
          const isFuture = day.getTime() > today.getTime();
          const isFrom = selecting.from && isSameDay(day, selecting.from);
          const isTo = rangeEnd && isSameDay(day, rangeEnd);
          const inRange = isInRange(day, selecting.from, rangeEnd);
          const isSelected = isFrom || isTo;

          return (
            <button
              key={day.getDate()}
              type="button"
              disabled={isFuture}
              onClick={() => onDayClick(day)}
              onMouseEnter={() => onDayHover(day)}
              onMouseLeave={() => onDayHover(null)}
              className={`h-7 text-xs rounded-md transition-colors ${
                isFuture
                  ? "text-gray-300 cursor-not-allowed"
                  : isSelected
                  ? "bg-gray-950 text-white font-semibold"
                  : inRange
                  ? "bg-gray-100 text-gray-950"
                  : isToday
                  ? "font-semibold text-gray-950"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const active = !!(value.from || value.to);
  const label = formatLabel(value);

  // Calendar view state
  const [viewDate, setViewDate] = useState(() => value.from || new Date());
  const [selecting, setSelecting] = useState<DateRange>(value);
  const [step, setStep] = useState<"from" | "to">("from");
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  // Sync when value changes externally
  useEffect(() => {
    setSelecting(value);
  }, [value.from?.getTime(), value.to?.getTime()]);

  const handleDayClick = useCallback(
    (day: Date) => {
      if (step === "from") {
        setSelecting({ from: startOfDay(day), to: null });
        setStep("to");
      } else {
        const from = selecting.from!;
        if (day.getTime() < from.getTime()) {
          setSelecting({ from: startOfDay(day), to: null });
          setStep("to");
        } else {
          const range = { from, to: endOfDay(day) };
          setSelecting(range);
          onChange(range);
          setStep("from");
        }
      }
    },
    [step, selecting.from, onChange]
  );

  const handlePreset = useCallback(
    (key: PresetKey) => {
      const range = getPresetRange(key);
      setSelecting(range);
      setViewDate(range.from!);
      onChange(range);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    const empty = { from: null, to: null };
    setSelecting(empty);
    setStep("from");
    onChange(empty);
  }, [onChange]);

  const prevMonth = () => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  return (
    <MenuContainer>
      <DateRangeTrigger label={label} active={active} onClear={handleClear} />
      <Menu width={320}>
        <div className="flex flex-col gap-2">
          {/* Presets */}
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => handlePreset(p.key)}
                className="px-2 h-6 text-xs font-medium rounded-md border border-gray-200 text-gray-700 hover:border-gray-400 hover:text-gray-950 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              className="flex items-center justify-center h-7 w-7 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-950 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M8.5 3.5L5 7L8.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="text-sm font-medium text-gray-950">
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="flex items-center justify-center h-7 w-7 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-950 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5.5 3.5L9 7L5.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* Calendar */}
          <CalendarMonth
            year={viewDate.getFullYear()}
            month={viewDate.getMonth()}
            selecting={selecting}
            hoverDate={step === "to" ? hoverDate : null}
            onDayClick={handleDayClick}
            onDayHover={setHoverDate}
          />

          {/* Footer */}
          {active && (
            <Button variant="secondary" className="w-full" size="small" onClick={handleClear}>
              Clear
            </Button>
          )}
        </div>
      </Menu>
    </MenuContainer>
  );
}

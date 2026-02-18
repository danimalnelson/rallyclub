"use client";

import { useState, useEffect, useCallback } from "react";
import { MenuContainer, Menu, useMenuContext, Button } from "@wine-club/ui";
import { ChevronLeft } from "@/components/icons/ChevronLeft";
import { ChevronRight } from "@/components/icons/ChevronRight";

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

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

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

function formatDateInput(d: Date): string {
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
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
      onClick={toggle}
      aria-expanded={isOpen}
      aria-haspopup="dialog"
      className={`group inline-flex items-center gap-1.5 px-2 h-8 rounded-md text-sm font-medium border transition-all duration-300 ${
        showActive
          ? "bg-gray-950 text-white border-gray-950 dark:bg-white dark:text-gray-950 dark:border-white"
          : "bg-white text-gray-950 border-gray-300 hover:bg-[--ds-gray-100] hover:border-gray-500 dark:border-gray-600 dark:bg-gray-100 dark:text-white dark:hover:border-gray-400"
      }`}
    >
      <span>Date</span>
      {active && label && (
        <>
          <span className="opacity-40">|</span>
          <span className="font-normal">{label}</span>
        </>
      )}
      {showActive ? (
        <span
          role="button"
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          className="shrink-0 flex items-center justify-center w-6 h-6 rounded-sm hover:opacity-70 -mr-1"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
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

  // For the preview range, ensure from < to even when hovering before the start date
  const previewEnd = selecting.to || hoverDate;
  const rangeFrom = selecting.from && previewEnd && previewEnd.getTime() < selecting.from.getTime()
    ? previewEnd : selecting.from;
  const rangeTo = selecting.from && previewEnd && previewEnd.getTime() < selecting.from.getTime()
    ? selecting.from : previewEnd;

  // Build rows of 7 cells
  const rows: (Date | null)[][] = [];
  let row: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) row.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    row.push(new Date(year, month, d));
    if (row.length === 7) { rows.push(row); row = []; }
  }
  if (row.length > 0) {
    while (row.length < 7) row.push(null);
    rows.push(row);
  }

  return (
    <table className="mx-auto" style={{ width: 224, tableLayout: "fixed", borderSpacing: "0 6px", borderCollapse: "separate", marginTop: -6 }}>
      <thead>
        <tr>
          {DAYS.map((d, i) => (
            <th key={i} style={{ width: 32, height: 32 }} className="text-center text-xs font-medium text-gray-900 p-0">
              {d}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((week, wi) => (
          <tr key={wi}>
            {week.map((day, di) => {
              if (!day) return <td key={`empty-${wi}-${di}`} style={{ width: 32, height: 32 }} className="p-0" />;

              const isToday = isSameDay(day, today);
              const isFuture = day.getTime() > today.getTime();
              const isFrom = rangeFrom && isSameDay(day, rangeFrom);
              const isTo = rangeTo && isSameDay(day, rangeTo);
              const inRange = isInRange(day, rangeFrom, rangeTo);
              const isSelected = isFrom || isTo;
              const isInBand = inRange || isSelected;

              // Check if neighbors in this row are also part of the range band
              const prevDay = di > 0 ? week[di - 1] : null;
              const nextDay = di < 6 ? week[di + 1] : null;
              const prevInBand = prevDay && (
                isInRange(prevDay, rangeFrom, rangeTo) ||
                (rangeFrom && isSameDay(prevDay, rangeFrom)) ||
                (rangeTo && isSameDay(prevDay, rangeTo))
              );
              const nextInBand = nextDay && (
                isInRange(nextDay, rangeFrom, rangeTo) ||
                (rangeFrom && isSameDay(nextDay, rangeFrom)) ||
                (rangeTo && isSameDay(nextDay, rangeTo))
              );

              const roundL = isInBand && !prevInBand;
              const roundR = isInBand && !nextInBand;
              const rounding = isSelected
                ? "rounded-md"
                : `${roundL ? "rounded-l-md" : ""} ${roundR ? "rounded-r-md" : ""}`;

              return (
                <td key={`${year}-${month}-${day.getDate()}`} style={{ width: 32, height: 32 }} className="p-0">
                  <button
                    type="button"
                    disabled={isFuture}
                    onClick={() => onDayClick(day)}
                    onMouseEnter={() => onDayHover(day)}
                    onMouseLeave={() => onDayHover(null)}
                    style={{ width: 32, height: 32 }}
                    className={`text-sm ${
                      isFuture
                        ? "text-gray-500 cursor-not-allowed"
                        : isSelected
                        ? `bg-gray-950 text-white font-semibold ${rounding}`
                        : inRange
                        ? `bg-gray-200 text-gray-950 ${rounding}`
                        : isToday
                        ? "font-semibold text-gray-950"
                        : "text-gray-950 hover:bg-gray-100 rounded-md"
                    }`}
                  >
                    {day.getDate()}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const active = !!(value.from || value.to);
  const label = formatLabel(value);

  const [menuOpen, setMenuOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => value.from || new Date());
  const [selecting, setSelecting] = useState<DateRange>(value);
  const [step, setStep] = useState<"from" | "to">("from");
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [startText, setStartText] = useState("");
  const [endText, setEndText] = useState("");

  // Reset draft state when the popover opens
  useEffect(() => {
    if (menuOpen) {
      const today = new Date();
      const defaultFrom = value.from || startOfDay(today);
      const defaultTo = value.to || endOfDay(today);
      setSelecting({ from: defaultFrom, to: defaultTo });
      setStep("from");
      setHoverDate(null);
      setViewDate(defaultFrom);
      setStartText(formatDateInput(defaultFrom));
      setEndText(formatDateInput(defaultTo));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen]);

  const handleDayClick = useCallback(
    (day: Date) => {
      if (step === "from") {
        const from = startOfDay(day);
        setSelecting({ from, to: null });
        setStartText(formatDateInput(from));
        setEndText("");
        setStep("to");
      } else {
        const from = selecting.from!;
        if (day.getTime() < from.getTime()) {
          const newFrom = startOfDay(day);
          setSelecting({ from: newFrom, to: null });
          setStartText(formatDateInput(newFrom));
          setEndText("");
          setStep("to");
        } else {
          const to = endOfDay(day);
          onChange({ from, to });
          setMenuOpen(false);
        }
      }
    },
    [step, selecting.from, onChange]
  );

  const tryParseDate = (text: string): Date | null => {
    const d = new Date(text);
    if (isNaN(d.getTime())) return null;
    return d;
  };

  const handleStartBlur = () => {
    const parsed = tryParseDate(startText);
    if (parsed) {
      const from = startOfDay(parsed);
      setSelecting((prev) => ({ ...prev, from }));
      setStartText(formatDateInput(from));
      setViewDate(from);
    } else if (selecting.from) {
      setStartText(formatDateInput(selecting.from));
    } else {
      setStartText("");
    }
  };

  const handleEndBlur = () => {
    const parsed = tryParseDate(endText);
    if (parsed) {
      const to = endOfDay(parsed);
      setSelecting((prev) => ({ ...prev, to }));
      setEndText(formatDateInput(to));
    } else if (selecting.to) {
      setEndText(formatDateInput(selecting.to));
    } else {
      setEndText("");
    }
  };

  const handleApply = useCallback(() => {
    if (!selecting.from || !selecting.to) return;
    onChange({ from: selecting.from, to: selecting.to });
    setMenuOpen(false);
  }, [selecting, onChange]);

  const handleClear = useCallback(() => {
    setSelecting({ from: null, to: null });
    setStep("from");
    onChange({ from: null, to: null });
  }, [onChange]);

  const prevMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const canApply = !!(selecting.from && selecting.to);

  return (
    <MenuContainer open={menuOpen} onOpenChange={setMenuOpen}>
      <DateRangeTrigger label={label} active={active} onClear={handleClear} />
      <Menu width={248}>
        <div className="flex flex-col gap-3 p-1">
          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-900" style={{ fontSize: 13 }}>
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                className="flex items-center justify-center h-7 w-7 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-950 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="flex items-center justify-center h-7 w-7 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-950 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
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

          <hr className="border-gray-200 -mx-3" style={{ marginLeft: -12, marginRight: -12 }} />

          {/* Start / End date inputs */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-gray-900" style={{ fontSize: 13 }}>Start</label>
              <input
                type="text"
                value={startText}
                onChange={(e) => setStartText(e.target.value)}
                onBlur={handleStartBlur}
                onKeyDown={(e) => { if (e.key === "Enter") { handleStartBlur(); canApply && handleApply(); } }}
                placeholder="Select date"
                className="w-full px-3 h-8 text-sm border border-gray-300 rounded-md bg-white text-gray-950 outline-none focus:ring-2 focus:ring-gray-950/20 focus:border-gray-800 transition-all"
              />
            </div>
            <div>
              <label className="block text-gray-900" style={{ fontSize: 13 }}>End</label>
              <input
                type="text"
                value={endText}
                onChange={(e) => setEndText(e.target.value)}
                onBlur={handleEndBlur}
                onKeyDown={(e) => { if (e.key === "Enter") { handleEndBlur(); canApply && handleApply(); } }}
                placeholder="Select date"
                className="w-full px-3 h-8 text-sm border border-gray-300 rounded-md bg-white text-gray-950 outline-none focus:ring-2 focus:ring-gray-950/20 focus:border-gray-800 transition-all"
              />
            </div>
          </div>

          {/* Apply */}
          <Button
            className="w-full"
            size="small"
            disabled={!canApply}
            onClick={handleApply}
          >
            Apply
          </Button>
        </div>
      </Menu>
    </MenuContainer>
  );
}

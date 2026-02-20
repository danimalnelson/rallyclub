"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, MenuContainer, Menu, useMenuContext } from "@wine-club/ui";

interface FilterPillProps {
  /** The base label that always stays visible (e.g., "Name") */
  label: string;
  /** The active filter value to display after the pipe (e.g., "Dan") */
  activeValue?: string;
  active: boolean;
  onToggle: () => void;
  onClear?: () => void;
  children: React.ReactNode;
  isOpen: boolean;
  /** Footer content pinned below menu body (e.g., Apply button) */
  footer?: React.ReactNode;
}


function FilterPillTrigger({ label, activeValue, active, onClear }: { label: string; activeValue?: string; active: boolean; onClear?: () => void }) {
  const { isOpen, toggle, triggerRef } = useMenuContext();

  // Defer active styling briefly on mount so the transition is visible
  const [showActive, setShowActive] = useState(false);
  useEffect(() => {
    if (active) {
      const t = requestAnimationFrame(() => setShowActive(true));
      return () => cancelAnimationFrame(t);
    }
    setShowActive(false);
  }, [active]);

  const mergedRef = useCallback(
    (node: HTMLButtonElement | null) => {
      triggerRef.current = node;
    },
    [triggerRef],
  );

  const suffixIcon = showActive ? (
    <span
      role="button"
      onClick={(e) => { e.stopPropagation(); onClear?.(); }}
      className="flex items-center justify-center w-4 h-4 rounded-sm hover:opacity-70"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  ) : (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return (
    <Button
      ref={mergedRef}
      variant={showActive ? "default" : "secondary"}
      size="small"
      onClick={toggle}
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      suffix={suffixIcon}
      className={
        showActive
          ? "font-normal border border-gray-950 dark:border-white transition-all duration-300"
          : "font-normal transition-all duration-300"
      }
    >
      {label}
      {active && activeValue && (
        <>
          <span className="opacity-40">|</span>
          <span className="font-normal">{activeValue}</span>
        </>
      )}
    </Button>
  );
}

export function FilterPill({ label, activeValue, active, onToggle, onClear, children, isOpen, footer }: FilterPillProps) {
  return (
    <MenuContainer
      open={isOpen}
      onOpenChange={(open) => {
        if (open !== isOpen) onToggle();
      }}
    >
      <FilterPillTrigger label={label} activeValue={activeValue} active={active} onClear={onClear} />
      <Menu width={240} footer={footer}>
        {children}
      </Menu>
    </MenuContainer>
  );
}

"use client";

import { useEffect, useState } from "react";
import { MenuContainer, Menu, useMenuContext } from "@wine-club/ui";

interface FilterPillProps {
  /** The base label that always stays visible (e.g., "Name") */
  label: string;
  /** The active filter value to display after the pipe (e.g., "Dan") */
  activeValue?: string;
  active: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  isOpen: boolean;
  /** Footer content pinned below menu body (e.g., Apply button) */
  footer?: React.ReactNode;
}


function FilterPillTrigger({ label, activeValue, active }: { label: string; activeValue?: string; active: boolean }) {
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

  return (
    <button
      ref={triggerRef}
      onClick={toggle}
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      className={`group inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium border transition-all duration-300 ${
        showActive
          ? "bg-gray-950 text-white border-gray-950 dark:bg-white dark:text-gray-950 dark:border-white"
          : "bg-white text-gray-950 border-gray-300 hover:bg-[--ds-gray-100] hover:border-gray-500 dark:border-gray-600 dark:bg-gray-100 dark:text-white dark:hover:border-gray-400"
      }`}
    >
      <span>{label}</span>
      {active && activeValue && (
        <>
          <span className="opacity-40">|</span>
          <span className="font-semibold">{activeValue}</span>
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

export function FilterPill({ label, activeValue, active, onToggle, children, isOpen, footer }: FilterPillProps) {
  return (
    <MenuContainer
      open={isOpen}
      onOpenChange={(open) => {
        // Only toggle when state actually changes
        if (open !== isOpen) onToggle();
      }}
    >
      <FilterPillTrigger label={label} activeValue={activeValue} active={active} />
      <Menu width={240} footer={footer}>
        {children}
      </Menu>
    </MenuContainer>
  );
}

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

function PlusIcon({ active, className }: { active?: boolean; className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={className}>
      <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeWidth="1" />
      <g
        className="transition-transform duration-300"
        style={{ transformOrigin: "6px 6px", transform: active ? "rotate(45deg)" : "rotate(0deg)" }}
      >
        <path d="M6 3.5V8.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <path d="M3.5 6H8.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </g>
    </svg>
  );
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
      className={`group inline-flex items-center gap-1.5 px-2 h-6 rounded-full text-xs font-medium border transition-all duration-300 ${
        showActive
          ? "bg-gray-950 text-white border-gray-950 dark:bg-white dark:text-gray-950 dark:border-white"
          : "bg-white text-gray-900 border-gray-300 hover:border-gray-700 hover:text-gray-950 dark:bg-gray-100 dark:text-gray-800 dark:border-gray-600 dark:hover:border-gray-400 dark:hover:text-white"
      }`}
    >
      {/* Fixed 12x12 icon container — rotate + to × when active */}
      <span className="flex items-center justify-center w-3 h-3 shrink-0">
        <PlusIcon
          active={showActive}
          className={showActive ? "" : "group-hover:text-gray-950"}
        />
      </span>
      <span>{label}</span>
      {active && activeValue && (
        <>
          <span className="opacity-40">|</span>
          <span className="font-semibold">{activeValue}</span>
        </>
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

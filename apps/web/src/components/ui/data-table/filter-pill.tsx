"use client";

import { useRef, useEffect } from "react";
import Image from "next/image";

interface FilterPillProps {
  /** The base label that always stays visible (e.g., "Name") */
  label: string;
  /** The active filter value to display after the pipe (e.g., "Dan") */
  activeValue?: string;
  active: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  isOpen: boolean;
}

export function FilterPill({ label, activeValue, active, onToggle, children, isOpen }: FilterPillProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        if (isOpen) onToggle();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onToggle]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={onToggle}
        className={`group inline-flex items-center gap-1.5 px-2 h-6 rounded-full text-xs font-medium border transition-colors ${
          active
            ? "bg-[#171717] text-white border-[#171717]"
            : "bg-white text-[#666] border-[#e0e0e0] hover:border-[#ccc] hover:text-[#171717]"
        }`}
      >
        {/* Fixed 12x12 icon container so label never shifts */}
        <span className="flex items-center justify-center w-3 h-3 shrink-0">
          {active ? (
            <Image src="/filter-x.svg" alt="" width={12} height={12} className="brightness-0 invert" />
          ) : (
            <Image src="/filter-plus.svg" alt="" width={12} height={12} className="brightness-50 transition-all group-hover:brightness-0" />
          )}
        </span>
        <span>{label}</span>
        {active && activeValue && (
          <>
            <span className="opacity-40">|</span>
            <span className="font-semibold">{activeValue}</span>
          </>
        )}
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-lg shadow-lg border border-[#eaeaea] overflow-hidden">
          {children}
        </div>
      )}
    </div>
  );
}

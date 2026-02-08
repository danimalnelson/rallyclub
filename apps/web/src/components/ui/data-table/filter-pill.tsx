"use client";

import { useRef, useEffect } from "react";
import { Plus, X } from "lucide-react";

interface FilterPillProps {
  label: string;
  active: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  isOpen: boolean;
}

export function FilterPill({ label, active, onToggle, children, isOpen }: FilterPillProps) {
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
        className={`inline-flex items-center gap-1 px-2 h-6 rounded-full text-xs font-medium border transition-colors ${
          active
            ? "bg-[#171717] text-white border-[#171717]"
            : "bg-white text-[#666] border-[#e0e0e0] hover:border-[#ccc] hover:text-[#171717]"
        }`}
      >
        {!active && <Plus className="h-3.5 w-3.5" />}
        {label}
        {active && <X className="h-3.5 w-3.5 ml-0.5" />}
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-lg shadow-lg border border-[#eaeaea] overflow-hidden">
          {children}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useCallback } from "react";
import { X } from "lucide-react";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string; // default "480px"
}

export function Drawer({ open, onClose, title, children, width = "480px" }: DrawerProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, handleEscape]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-[#fafafa]/75 transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-50 flex flex-col bg-white border-l border-[#eaeaea] shadow-xl transition-transform duration-200 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 h-14 border-b border-[#eaeaea] shrink-0">
          <h2 className="text-sm font-medium text-[#171717]">{title}</h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-[#f5f5f5] transition-colors"
          >
            <X className="h-4 w-4 text-[#666]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </>
  );
}

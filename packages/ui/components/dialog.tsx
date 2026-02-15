"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";

// ---------------------------------------------------------------------------
// Inline close icon
// ---------------------------------------------------------------------------

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.4697 13.5303L13 14.0607L14.0607 13L13.5303 12.4697L9.06065 7.99999L13.5303 3.53032L14.0607 2.99999L13 1.93933L12.4697 2.46966L7.99999 6.93933L3.53032 2.46966L2.99999 1.93933L1.93933 2.99999L2.46966 3.53032L6.93933 7.99999L2.46966 12.4697L1.93933 13L2.99999 14.0607L3.53032 13.5303L7.99999 9.06065L12.4697 13.5303Z"
        fill="currentColor"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when the dialog should close */
  onClose: () => void;
  /** Dialog title */
  title: string;
  /** Optional description below the title */
  description?: string;
  /** Dialog body content */
  children: React.ReactNode;
  /** Optional footer (e.g. action buttons) */
  footer?: React.ReactNode;
  /** Max width class. Default "max-w-md" */
  maxWidth?: string;
  /** Additional className for the dialog panel */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Modal dialog with overlay, focus trap, close button, and footer slot.
 *
 * @example
 * <Dialog open={isOpen} onClose={() => setIsOpen(false)} title="Confirm">
 *   <p>Are you sure?</p>
 *   <Dialog.Footer>
 *     <Button variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
 *     <Button variant="error" onClick={handleDelete}>Delete</Button>
 *   </Dialog.Footer>
 * </Dialog>
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = "max-w-md",
  className,
}: DialogProps) {
  const [mounted, setMounted] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  React.useEffect(() => setMounted(true), []);

  // Escape key
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Focus management and scroll lock
  React.useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      document.body.style.overflow = "hidden";

      requestAnimationFrame(() => {
        if (panelRef.current) {
          const focusables = getFocusableElements(panelRef.current);
          focusables[0]?.focus();
        }
      });
    }
    return () => {
      document.body.style.overflow = "";
      previousFocusRef.current?.focus?.();
    };
  }, [open]);

  // Focus trap
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusables = getFocusableElements(panelRef.current);
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  if (!mounted || typeof document === "undefined" || !open) return null;

  return createPortal(
    <>
      {/* Overlay */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
      />

      {/* Dialog panel */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full rounded-lg bg-white dark:bg-gray-100 shadow-lg",
            maxWidth,
            className,
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 pb-0">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-xl font-bold text-gray-950 dark:text-white">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="text-sm text-gray-600 dark:text-gray-800 mt-1">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex items-center justify-center h-8 w-8 rounded-md text-gray-600 hover:text-gray-950 hover:bg-gray-100 dark:text-gray-700 dark:hover:text-white dark:hover:bg-gray-200 transition-colors shrink-0 -mr-2"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="flex gap-3 justify-end px-6 pb-6">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}

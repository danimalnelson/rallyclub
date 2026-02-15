"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { cn } from "../lib/utils";
import { Button, type ButtonProps } from "./button";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface MenuContextValue {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
  triggerRef: React.MutableRefObject<HTMLButtonElement | null>;
  menuRef: React.MutableRefObject<HTMLDivElement | null>;
}

const MenuContext = React.createContext<MenuContextValue | null>(null);

function useMenuContext() {
  const ctx = React.useContext(MenuContext);
  if (!ctx) throw new Error("Menu components must be used within <MenuContainer>");
  return ctx;
}

// ---------------------------------------------------------------------------
// MenuContainer
// ---------------------------------------------------------------------------

interface MenuContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Controlled mode: externally managed open state */
  open?: boolean;
  /** Controlled mode: callback when open state should change */
  onOpenChange?: (open: boolean) => void;
}

function MenuContainer({ children, className, open, onOpenChange }: MenuContainerProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const setOpen = React.useCallback(
    (value: boolean) => {
      if (isControlled) {
        onOpenChange?.(value);
      } else {
        setInternalOpen(value);
      }
    },
    [isControlled, onOpenChange]
  );

  const toggle = React.useCallback(() => setOpen(!isOpen), [setOpen, isOpen]);
  const close = React.useCallback(() => setOpen(false), [setOpen]);

  // Click outside — check both container and portal-rendered menu
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inMenu = menuRef.current?.contains(target);
      if (!inContainer && !inMenu) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, setOpen]);

  // Escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, setOpen]);

  const value = React.useMemo(
    () => ({ isOpen, toggle, close, triggerRef, menuRef }),
    [isOpen, toggle, close]
  );

  return (
    <MenuContext.Provider value={value}>
      <div ref={containerRef} className={cn("relative", className)}>
        {children}
      </div>
    </MenuContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// ChevronDown icon (inline SVG to avoid external dependency)
// ---------------------------------------------------------------------------

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={className}
    >
      <path
        d="M4 6L8 10L12 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// MenuButton
// ---------------------------------------------------------------------------

interface MenuButtonProps extends Omit<ButtonProps, "onClick"> {
  /** Show a chevron that rotates when open */
  showChevron?: boolean;
}

const MenuButton = React.forwardRef<HTMLButtonElement, MenuButtonProps>(
  ({ showChevron, suffix, children, ...props }, forwardedRef) => {
    const { isOpen, toggle, triggerRef } = useMenuContext();

    // Merge forwarded ref with context triggerRef
    const mergedRef = React.useCallback(
      (node: HTMLButtonElement | null) => {
        (triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
      },
      [forwardedRef, triggerRef]
    );

    const chevron = showChevron ? (
      <ChevronDownIcon
        className={cn(
          "transition-transform duration-200",
          isOpen && "rotate-180"
        )}
      />
    ) : null;

    const resolvedSuffix = chevron
      ? suffix
        ? (
            <>
              {suffix}
              {chevron}
            </>
          )
        : chevron
      : suffix;

    return (
      <Button
        ref={mergedRef}
        onClick={toggle}
        suffix={resolvedSuffix}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        {...props}
      >
        {children}
      </Button>
    );
  }
);
MenuButton.displayName = "MenuButton";

// ---------------------------------------------------------------------------
// Menu (portal-positioned dropdown panel)
// ---------------------------------------------------------------------------

interface MenuProps {
  children: React.ReactNode;
  /** Fixed pixel width for the menu */
  width?: number;
  /** Horizontal alignment relative to the trigger */
  align?: "start" | "end";
  /** Sticky footer content (e.g., Apply button for filters) */
  footer?: React.ReactNode;
  /** Additional className for the outer container */
  className?: string;
}

function MenuPanel({ children, width, align = "start", footer, className }: MenuProps) {
  const { isOpen, triggerRef, close, menuRef } = useMenuContext();
  const [pos, setPos] = React.useState<{ top: number; left: number; placement: "below" | "above" } | null>(null);

  // Calculate position
  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current || !menuRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();
    const gap = 4;
    const margin = 8;

    // Determine vertical placement
    const spaceBelow = window.innerHeight - triggerRect.bottom - gap;
    const spaceAbove = triggerRect.top - gap;
    const placement = spaceBelow >= menuRect.height || spaceBelow >= spaceAbove ? "below" : "above";

    let top: number;
    if (placement === "below") {
      top = triggerRect.bottom + gap;
    } else {
      top = triggerRect.top - gap - menuRect.height;
    }

    // Horizontal alignment
    let left: number;
    if (align === "end") {
      left = triggerRect.right - menuRect.width;
    } else {
      left = triggerRect.left;
    }

    // Clamp to viewport
    left = Math.max(margin, Math.min(left, window.innerWidth - menuRect.width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - menuRect.height - margin));

    setPos({ top, left, placement });
  }, [align, triggerRef]);

  // Position on open and on scroll/resize
  React.useEffect(() => {
    if (!isOpen) {
      setPos(null);
      return;
    }

    // Use requestAnimationFrame to ensure the menu is rendered before measuring
    const raf = requestAnimationFrame(() => updatePosition());

    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Keyboard navigation
  React.useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const handler = (e: KeyboardEvent) => {
      const menu = menuRef.current;
      if (!menu) return;

      const items = Array.from(
        menu.querySelectorAll<HTMLElement>(
          '[role="menuitem"]:not([aria-disabled="true"])'
        )
      );
      if (items.length === 0) return;

      const currentIndex = items.findIndex((el) => el === document.activeElement);

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const next = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
          items[next]?.focus();
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prev = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
          items[prev]?.focus();
          break;
        }
        case "Home": {
          e.preventDefault();
          items[0]?.focus();
          break;
        }
        case "End": {
          e.preventDefault();
          items[items.length - 1]?.focus();
          break;
        }
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className={cn(
        "fixed z-[100] rounded-lg border border-gray-300 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-100",
        !pos && "opacity-0",
        footer ? undefined : "p-2",
        className,
      )}
      style={{
        width: width ? `${width}px` : undefined,
        top: pos ? `${pos.top}px` : 0,
        left: pos ? `${pos.left}px` : 0,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {footer ? (
        <>
          <div className="max-h-[min(320px,50vh)] overflow-y-auto p-2">
            {children}
          </div>
          <div className="border-t border-gray-300 dark:border-gray-600 p-2 shrink-0">
            {footer}
          </div>
        </>
      ) : (
        children
      )}
    </div>,
    document.body
  );
}

// We name the export "Menu" but the internal component is MenuPanel
// to avoid confusion with the HTML <menu> element
const Menu = MenuPanel;

// ---------------------------------------------------------------------------
// MenuItem
// ---------------------------------------------------------------------------

interface MenuItemProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  href?: string;
  /** Visual variant -- "error" renders red text */
  type?: "error";
  disabled?: boolean;
  /** Icon or element before text */
  prefix?: React.ReactNode;
  /** Icon or element after text */
  suffix?: React.ReactNode;
  className?: string;
}

function MenuItem({
  children,
  onClick,
  href,
  type,
  disabled,
  prefix,
  suffix,
  className,
}: MenuItemProps) {
  const { close } = useMenuContext();

  const baseClasses = cn(
    "group w-full flex items-center gap-2 px-2 h-9 text-left text-sm rounded-md transition-colors outline-none",
    "focus-visible:bg-gray-100",
    type === "error"
      ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
      : "text-gray-950 hover:bg-gray-100 dark:text-white",
    disabled && "opacity-50 pointer-events-none",
    className,
  );

  const content = (
    <>
      {prefix && <span className="shrink-0">{prefix}</span>}
      <span className="flex-1">{children}</span>
      {suffix && <span className="shrink-0">{suffix}</span>}
    </>
  );

  if (href && !disabled) {
    return (
      <Link
        href={href}
        role="menuitem"
        className={baseClasses}
        onClick={(e) => {
          onClick?.(e);
          close();
        }}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      role="menuitem"
      aria-disabled={disabled || undefined}
      disabled={disabled}
      className={baseClasses}
      onClick={(e) => {
        if (disabled) return;
        onClick?.(e);
        close();
      }}
    >
      {content}
    </button>
  );
}

// ---------------------------------------------------------------------------
// MenuDivider
// ---------------------------------------------------------------------------

function MenuDivider() {
  return <div className="my-2 -mx-2 border-t border-gray-300 dark:border-gray-600" role="separator" />;
}

// ---------------------------------------------------------------------------
// MenuSection (for arbitrary/complex content inside menus)
// ---------------------------------------------------------------------------

interface MenuSectionProps {
  children: React.ReactNode;
  className?: string;
}

function MenuSection({ children, className }: MenuSectionProps) {
  return <div className={cn("py-1 first:pt-0 last:pb-0", className)}>{children}</div>;
}

// ---------------------------------------------------------------------------
// MenuIconTrigger (pre-built icon-only trigger, e.g. "three-dot" menu)
// ---------------------------------------------------------------------------

interface MenuIconTriggerProps {
  /** The icon element to render (e.g., <MoreVertical />) */
  children: React.ReactNode;
  /** Accessible label for the trigger button */
  label?: string;
  /** Additional className */
  className?: string;
}

/**
 * Pre-built icon-only menu trigger. Use inside a MenuContainer.
 *
 * @example
 * <MenuContainer>
 *   <MenuIconTrigger><MoreVertical className="h-4 w-4" /></MenuIconTrigger>
 *   <Menu width={192} align="end">
 *     <MenuItem>Edit</MenuItem>
 *   </Menu>
 * </MenuContainer>
 */
const MenuIconTrigger = React.forwardRef<HTMLButtonElement, MenuIconTriggerProps>(
  ({ children, label = "More actions", className }, forwardedRef) => {
    const { toggle, triggerRef } = useMenuContext();

    const mergedRef = React.useCallback(
      (node: HTMLButtonElement | null) => {
        (triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
      },
      [forwardedRef, triggerRef],
    );

    return (
      <button
        ref={mergedRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        className={cn(
          "flex h-[30px] w-[30px] shrink-0 items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-gray-950 dark:text-gray-700 dark:hover:text-white",
          className,
        )}
      >
        {children}
      </button>
    );
  },
);
MenuIconTrigger.displayName = "MenuIconTrigger";

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  MenuContainer,
  MenuButton,
  Menu,
  MenuItem,
  MenuDivider,
  MenuSection,
  MenuIconTrigger,
  useMenuContext,
};

export type { MenuContainerProps, MenuButtonProps, MenuProps, MenuItemProps, MenuSectionProps, MenuIconTriggerProps };

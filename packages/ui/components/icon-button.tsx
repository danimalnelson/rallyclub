import * as React from "react";
import { cn } from "../lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** The icon element to render */
  children: React.ReactNode;
  /** Accessible label (required for icon-only buttons) */
  label: string;
  /** Size variant */
  size?: "small" | "medium" | "large";
  /** Visual variant */
  variant?: "default" | "ghost" | "error";
}

// ---------------------------------------------------------------------------
// Size / variant maps
// ---------------------------------------------------------------------------

const SIZE_CLASSES = {
  small: "h-7 w-7",
  medium: "h-8 w-8",
  large: "h-9 w-9",
} as const;

const VARIANT_CLASSES = {
  default:
    "text-gray-600 hover:bg-gray-100 hover:text-gray-950 dark:text-gray-700 dark:hover:bg-gray-200 dark:hover:text-white",
  ghost:
    "text-gray-600 hover:text-gray-950 dark:text-gray-700 dark:hover:text-white",
  error:
    "text-gray-600 hover:bg-red-50 hover:text-red-600 dark:text-gray-700 dark:hover:bg-red-950 dark:hover:text-red-400",
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Square icon-only button for toolbars, row actions, and compact controls.
 * Always requires a `label` for accessibility.
 *
 * @example
 * <IconButton label="Edit" onClick={handleEdit}>
 *   <Pencil className="h-4 w-4" />
 * </IconButton>
 */
const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      children,
      label,
      size = "medium",
      variant = "default",
      className,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        title={label}
        aria-label={label}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center shrink-0 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          SIZE_CLASSES[size],
          VARIANT_CLASSES[variant],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
IconButton.displayName = "IconButton";

export { IconButton };

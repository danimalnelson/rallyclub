import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

// ---------------------------------------------------------------------------
// Variants (cva)
// ---------------------------------------------------------------------------

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      type: {
        default:
          "bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200",
        secondary:
          "border border-neutral-300 bg-white text-neutral-950 hover:border-neutral-700 dark:border-neutral-600 dark:bg-neutral-100 dark:text-white dark:hover:border-neutral-400",
        tertiary:
          "bg-transparent text-neutral-950 hover:bg-neutral-100 dark:text-white dark:hover:bg-neutral-800",
        error:
          "bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700",
        warning:
          "bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700",
      },
      size: {
        small: "h-8 px-3 text-sm gap-1.5",
        medium: "h-9 px-4 text-sm gap-2",
        large: "h-10 px-5 text-sm gap-2",
      },
      shape: {
        square: "rounded-md",
        rounded: "rounded-full",
      },
    },
    defaultVariants: {
      type: "default",
      size: "medium",
      shape: "square",
    },
  }
);

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      width="16"
      height="16"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type" | "prefix" | "suffix">,
    VariantProps<typeof buttonVariants> {
  /** HTML button type attribute */
  htmlType?: React.ButtonHTMLAttributes<HTMLButtonElement>["type"];
  /** Visual style variant */
  type?: "default" | "secondary" | "tertiary" | "error" | "warning";
  /** Render as child element (Radix Slot) */
  asChild?: boolean;
  /** Icon or element before children */
  prefix?: React.ReactNode;
  /** Icon or element after children */
  suffix?: React.ReactNode;
  /** Show loading spinner */
  loading?: boolean;
  /** Add subtle box-shadow */
  shadow?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      type = "default",
      size,
      shape,
      asChild = false,
      prefix,
      suffix,
      loading = false,
      shadow = false,
      disabled,
      htmlType = "button",
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = disabled || loading;

    // For asChild, just pass through with variants
    if (asChild) {
      return (
        <Comp
          className={cn(
            buttonVariants({ type, size, shape, className }),
            shadow && "shadow-sm",
          )}
          ref={ref}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    return (
      <Comp
        className={cn(
          buttonVariants({ type, size, shape, className }),
          shadow && "shadow-sm",
          loading && "pointer-events-none",
        )}
        ref={ref}
        disabled={isDisabled}
        type={htmlType}
        {...props}
      >
        {loading ? (
          <>
            <Spinner className="shrink-0" />
            <span className="opacity-0">{children}</span>
          </>
        ) : (
          <>
            {prefix && <span className="shrink-0">{prefix}</span>}
            {children}
            {suffix && <span className="shrink-0">{suffix}</span>}
          </>
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

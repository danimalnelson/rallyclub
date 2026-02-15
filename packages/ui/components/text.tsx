import * as React from "react";
import { cn } from "../lib/utils";

// ---------------------------------------------------------------------------
// Geist type scale — maps numeric size to Tailwind class
// ---------------------------------------------------------------------------

const SIZE_CLASSES = {
  12: "text-12",
  13: "text-13",
  14: "text-14",
  16: "text-16",
  20: "text-20",
  24: "text-24",
  32: "text-32",
  48: "text-48",
} as const;

export type TextSize = keyof typeof SIZE_CLASSES;

// ---------------------------------------------------------------------------
// Color variants — map to Geist DS gray tokens
// ---------------------------------------------------------------------------

const COLOR_CLASSES = {
  /** Default foreground — gray-1000 (near-black in light, near-white in dark) */
  default: "text-gray-950 dark:text-white",
  /** Secondary / muted text — gray-900 */
  secondary: "text-gray-900 dark:text-gray-800",
  /** Tertiary / subtle text — gray-700 */
  tertiary: "text-gray-700 dark:text-gray-600",
  /** Quaternary / disabled text — gray-600 */
  quaternary: "text-gray-600 dark:text-gray-500",
  /** Inherit color from parent */
  inherit: "",
  /** Semantic: error */
  error: "text-red-700 dark:text-red-600",
  /** Semantic: success */
  success: "text-green-700 dark:text-green-600",
  /** Semantic: warning */
  warning: "text-orange-700 dark:text-orange-600",
  /** White (always) */
  white: "text-white",
} as const;

export type TextColor = keyof typeof COLOR_CLASSES;

// ---------------------------------------------------------------------------
// Weight
// ---------------------------------------------------------------------------

const WEIGHT_CLASSES = {
  regular: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
} as const;

export type TextWeight = keyof typeof WEIGHT_CLASSES;

// ---------------------------------------------------------------------------
// Mono
// ---------------------------------------------------------------------------

const MONO_CLASS = "font-mono";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type TextElement = "p" | "span" | "div" | "label" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  /** Numeric pixel size from the Geist type scale. Default: 14 */
  size?: TextSize;
  /** Semantic color variant. Default: "default" */
  color?: TextColor;
  /** Font weight. Default: "regular" */
  weight?: TextWeight;
  /** Render as a specific HTML element. Default: "p" */
  as?: TextElement;
  /** Render in monospace (Geist Mono). Default: false */
  mono?: boolean;
  /** Truncate with ellipsis. Default: false */
  truncate?: boolean;
  children?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Text = React.forwardRef<HTMLElement, TextProps>(
  (
    {
      size = 14,
      color = "default",
      weight = "regular",
      as: Tag = "p",
      mono = false,
      truncate = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <Tag
        ref={ref as React.Ref<never>}
        className={cn(
          SIZE_CLASSES[size],
          COLOR_CLASSES[color],
          WEIGHT_CLASSES[weight],
          mono && MONO_CLASS,
          truncate && "truncate",
          className
        )}
        {...props}
      >
        {children}
      </Tag>
    );
  }
);
Text.displayName = "Text";

export { Text };

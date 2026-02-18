import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const inputVariants = cva(
  "flex w-full rounded-md border border-gray-300 bg-white text-sm text-gray-950 placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950/20 focus-visible:border-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-100 dark:text-white dark:placeholder:text-gray-700 dark:focus-visible:ring-white/20 dark:focus-visible:border-gray-400",
  {
    variants: {
      size: {
        small: "h-8 px-3",
        medium: "h-9 px-3",
        large: "h-10 px-3",
      },
    },
    defaultVariants: {
      size: "medium",
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, size, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input, inputVariants };

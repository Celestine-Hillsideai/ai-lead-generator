import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-accent-500 text-white hover:bg-accent-600 disabled:bg-accent-100 disabled:text-accent-400",
  secondary:
    "bg-paper-raised text-ink border border-border-strong hover:bg-paper-sunken disabled:text-ink-faint disabled:border-border",
  ghost: "bg-transparent text-ink-muted hover:bg-paper-sunken hover:text-ink disabled:text-ink-faint",
  danger: "bg-danger text-white hover:opacity-90 disabled:opacity-50",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
        "disabled:cursor-not-allowed",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";

import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/utils/cn";

const FIELD_CLASSES =
  "w-full rounded-lg border border-border-strong bg-paper-raised px-3 py-2 text-sm text-ink placeholder:text-ink-faint " +
  "focus:outline-none focus:ring-2 focus:ring-accent-400 focus:border-accent-400 disabled:bg-paper-sunken disabled:text-ink-faint";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(FIELD_CLASSES, className)} {...props} />
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(FIELD_CLASSES, "min-h-24 resize-y", className)} {...props} />
  )
);
Textarea.displayName = "Textarea";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-ink", className)} {...props} />;
}

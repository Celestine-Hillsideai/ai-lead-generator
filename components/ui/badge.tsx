import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils/cn";
import type { QualificationTier } from "../../types/status";

type Tone = "neutral" | "success" | "warning" | "danger" | "evidence" | "accent";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-paper-sunken text-ink-muted",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  evidence: "bg-evidence-100 text-evidence-600",
  accent: "bg-accent-100 text-accent-700",
};

const TIER_TONE: Record<QualificationTier, Tone> = {
  HIGH: "success",
  MEDIUM: "warning",
  LOW: "neutral",
  UNQUALIFIED: "danger",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    />
  );
}

export function TierBadge({ tier, className }: { tier: QualificationTier; className?: string }) {
  const labels: Record<QualificationTier, string> = {
    HIGH: "High fit",
    MEDIUM: "Medium fit",
    LOW: "Low fit",
    UNQUALIFIED: "Unqualified",
  };
  return (
    <Badge tone={TIER_TONE[tier]} className={className}>
      {labels[tier]}
    </Badge>
  );
}

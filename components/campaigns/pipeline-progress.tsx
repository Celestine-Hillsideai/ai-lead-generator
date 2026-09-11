import { Badge } from "../ui/badge";
import type { CompanyResearchStatus } from "../../types/status";

const STAGE_ORDER: CompanyResearchStatus[] = [
  "IMPORTED",
  "RESEARCHING",
  "RESEARCHED",
  "CONTACT_SEARCHING",
  "CONTACT_FOUND",
  "QUALIFYING",
  "QUALIFIED",
  "EMAIL_GENERATING",
  "EMAIL_READY",
  "NEEDS_REVIEW",
  "APPROVED",
  "FAILED",
];

const STAGE_TONE: Record<CompanyResearchStatus, "neutral" | "accent" | "success" | "warning" | "danger"> = {
  IMPORTED: "neutral",
  RESEARCHING: "accent",
  RESEARCHED: "accent",
  CONTACT_SEARCHING: "accent",
  CONTACT_FOUND: "accent",
  QUALIFYING: "accent",
  QUALIFIED: "success",
  EMAIL_GENERATING: "accent",
  EMAIL_READY: "success",
  NEEDS_REVIEW: "warning",
  APPROVED: "success",
  FAILED: "danger",
};

export function PipelineProgress({ statuses }: { statuses: CompanyResearchStatus[] }) {
  const total = statuses.length;
  const counts = STAGE_ORDER.map((stage) => ({
    stage,
    count: statuses.filter((s) => s === stage).length,
  })).filter((s) => s.count > 0);

  if (total === 0) {
    return <p className="text-sm text-ink-muted">No companies imported yet.</p>;
  }

  return (
    <div>
      <div className="mb-2 flex h-2 overflow-hidden rounded-full bg-paper-sunken">
        {counts.map(({ stage, count }) => (
          <div
            key={stage}
            className="h-full"
            style={{
              width: `${(count / total) * 100}%`,
              backgroundColor: `var(--color-${STAGE_TONE[stage] === "neutral" ? "border-strong" : STAGE_TONE[stage] === "accent" ? "accent-400" : STAGE_TONE[stage]})`,
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {counts.map(({ stage, count }) => (
          <Badge key={stage} tone={STAGE_TONE[stage]}>
            {stage.replaceAll("_", " ").toLowerCase()}: {count}
          </Badge>
        ))}
      </div>
    </div>
  );
}

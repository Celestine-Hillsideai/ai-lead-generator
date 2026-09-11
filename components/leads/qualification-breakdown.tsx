const FACTORS: { key: keyof BreakdownScores; label: string }[] = [
  { key: "industry_score", label: "Industry fit" },
  { key: "size_score", label: "Company size" },
  { key: "geography_score", label: "Geographic fit" },
  { key: "problem_score", label: "Problem/opportunity" },
  { key: "decision_maker_score", label: "Decision-maker fit" },
  { key: "buying_signal_score", label: "Buying signal" },
];

interface BreakdownScores {
  industry_score: number | null;
  size_score: number | null;
  geography_score: number | null;
  problem_score: number | null;
  decision_maker_score: number | null;
  buying_signal_score: number | null;
}

export function QualificationBreakdown({ qualification }: { qualification: BreakdownScores }) {
  return (
    <div className="space-y-3">
      {FACTORS.map(({ key, label }) => {
        const value = qualification[key] ?? 0;
        return (
          <div key={key}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-ink-muted">{label}</span>
              <span className="font-medium text-ink">{value}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-paper-sunken">
              <div className="h-full rounded-full bg-accent-400" style={{ width: `${value}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

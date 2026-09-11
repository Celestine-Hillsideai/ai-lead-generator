import { Card, CardBody } from "../ui/card";

export function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
        <p className="mt-2 font-display text-3xl font-semibold text-ink">{value}</p>
      </CardBody>
    </Card>
  );
}

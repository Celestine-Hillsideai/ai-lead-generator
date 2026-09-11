import { PageHeader } from "../../../components/layout/page-header";
import { Card, CardBody, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { DEFAULT_QUALIFICATION_WEIGHTS } from "../../../types/contracts";

/**
 * Read-only for now: these are env-var-driven (lib/ai, lib/search, lib/email
 * factories read process.env directly), not yet backed by an editable
 * per-user/per-campaign settings table. Spec §7 describes an editable
 * Settings page (AI provider/model, research limits, qualification weights,
 * sender info, email provider) -- persisting and editing those is real
 * follow-up work, not represented here as done.
 */
export default function SettingsPage() {
  const mockAi = process.env.MOCK_AI !== "false";
  const mockSearch = process.env.MOCK_SEARCH !== "false";
  const mockEmail = process.env.MOCK_EMAIL !== "false";

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" description="Current pipeline configuration (read-only, set via environment variables)." />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>AI provider</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <Row label="Provider" value={process.env.AI_PROVIDER ?? "openai (default)"} />
            <Row label="Mock mode">
              <Badge tone={mockAi ? "warning" : "success"}>{mockAi ? "MOCK_AI=true" : "live"}</Badge>
            </Row>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Search / contact-data provider</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <Row label="Mock mode">
              <Badge tone={mockSearch ? "warning" : "success"}>{mockSearch ? "MOCK_SEARCH=true" : "live"}</Badge>
            </Row>
            <p className="text-ink-muted">No real provider selected yet (spec §14) — mock only.</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <Row label="Mock mode">
              <Badge tone={mockEmail ? "warning" : "success"}>{mockEmail ? "MOCK_EMAIL=true" : "live (Resend)"}</Badge>
            </Row>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Qualification weights (default)</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <Row label="Industry fit" value={`${DEFAULT_QUALIFICATION_WEIGHTS.industryFit * 100}%`} />
            <Row label="Company size" value={`${DEFAULT_QUALIFICATION_WEIGHTS.companySize * 100}%`} />
            <Row label="Geographic fit" value={`${DEFAULT_QUALIFICATION_WEIGHTS.geographicFit * 100}%`} />
            <Row label="Problem/opportunity" value={`${DEFAULT_QUALIFICATION_WEIGHTS.problemOpportunity * 100}%`} />
            <Row label="Decision-maker fit" value={`${DEFAULT_QUALIFICATION_WEIGHTS.decisionMakerFit * 100}%`} />
            <Row label="Buying signal" value={`${DEFAULT_QUALIFICATION_WEIGHTS.buyingSignal * 100}%`} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cost controls</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <Row label="Max pages per company" value={process.env.MAX_PAGES_PER_COMPANY ?? "15"} />
            <Row label="Max companies per campaign" value={process.env.MAX_COMPANIES_PER_CAMPAIGN ?? "200"} />
            <Row label="Max concurrent requests" value={process.env.MAX_CONCURRENT_REQUESTS ?? "5"} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      {children ?? <span className="font-medium text-ink">{value}</span>}
    </div>
  );
}

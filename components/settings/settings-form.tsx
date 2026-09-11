"use client";

import { useActionState } from "react";
import { saveSettingsAction, type SaveSettingsResult } from "../../app/actions/settings";
import { Button } from "../ui/button";
import { Input, Label } from "../ui/input";
import { Card, CardBody, CardHeader, CardTitle } from "../ui/card";
import type { UserSettings } from "../../types/settings";

const WEIGHT_FIELDS: { key: keyof UserSettings["qualificationWeights"]; label: string }[] = [
  { key: "industryFit", label: "Industry fit" },
  { key: "companySize", label: "Company size" },
  { key: "geographicFit", label: "Geographic fit" },
  { key: "problemOpportunity", label: "Problem/opportunity" },
  { key: "decisionMakerFit", label: "Decision-maker fit" },
  { key: "buyingSignal", label: "Buying signal" },
];

export function SettingsForm({ initial }: { initial: UserSettings }) {
  const [state, formAction, pending] = useActionState<SaveSettingsResult, FormData>(
    async (_prev, formData) => saveSettingsAction(formData),
    {}
  );

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI provider</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm text-ink-muted">
            Actually used by the research pipeline for every campaign you own (only takes effect when{" "}
            <code className="rounded bg-paper-sunken px-1 py-0.5">MOCK_AI</code> is off in the Trigger.dev
            environment).
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="aiProvider">Provider</Label>
              <select
                id="aiProvider"
                name="aiProvider"
                defaultValue={initial.aiProvider}
                className="w-full rounded-lg border border-border-strong bg-paper-raised px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent-400 focus:border-accent-400"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>
            <div>
              <Label htmlFor="aiModel">Model (optional override)</Label>
              <Input id="aiModel" name="aiModel" defaultValue={initial.aiModel ?? ""} placeholder="e.g. gpt-4o-mini" />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Research limits</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="mb-4 text-sm text-ink-muted">Actually used by every campaign you run (spec §28 cost controls).</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="maxPagesPerCompany">Max pages per company</Label>
              <Input
                id="maxPagesPerCompany"
                name="maxPagesPerCompany"
                type="number"
                min={1}
                defaultValue={initial.maxPagesPerCompany}
                required
              />
            </div>
            <div>
              <Label htmlFor="maxCompaniesPerCampaign">Max companies per campaign</Label>
              <Input
                id="maxCompaniesPerCampaign"
                name="maxCompaniesPerCampaign"
                type="number"
                min={1}
                defaultValue={initial.maxCompaniesPerCampaign}
                required
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Qualification weights</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="mb-4 text-sm text-ink-muted">
            Actually used to score every lead (spec §15). Enter as a percentage (0-100); must sum to 100.
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {WEIGHT_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  name={key}
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  defaultValue={initial.qualificationWeights[key]}
                  required
                />
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm text-ink-muted">
            Stored, but <strong>not yet consumed</strong> by anything — sending isn&apos;t wired into the
            pipeline yet (spec Phase 10 is provider-interface-only). Safe to fill in now for when it is.
          </p>
          <div>
            <Label htmlFor="emailProvider">Provider</Label>
            <select
              id="emailProvider"
              name="emailProvider"
              defaultValue={initial.emailProvider}
              className="w-full max-w-xs rounded-lg border border-border-strong bg-paper-raised px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent-400 focus:border-accent-400"
            >
              <option value="mock">Mock (no real sends)</option>
              <option value="resend">Resend</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="senderName">Sender name</Label>
              <Input id="senderName" name="senderName" defaultValue={initial.senderName ?? ""} />
            </div>
            <div>
              <Label htmlFor="senderEmail">Sender email</Label>
              <Input id="senderEmail" name="senderEmail" type="email" defaultValue={initial.senderEmail ?? ""} />
            </div>
          </div>
        </CardBody>
      </Card>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.success && <p className="text-sm text-success">Settings saved.</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}

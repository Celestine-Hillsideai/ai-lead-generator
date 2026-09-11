"use client";

import { useActionState } from "react";
import { createCampaignAction } from "../../app/actions/campaigns";
import { Button } from "../ui/button";
import { Input, Textarea, Label } from "../ui/input";
import { Card, CardBody } from "../ui/card";

export function CampaignForm() {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => createCampaignAction(formData),
    {}
  );

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardBody className="space-y-4">
          <h2 className="font-display text-base font-semibold text-ink">Basics</h2>
          <div>
            <Label htmlFor="name">Campaign name</Label>
            <Input id="name" name="name" required placeholder="Q1 logistics outreach" />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" placeholder="Internal notes about this campaign" />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <h2 className="font-display text-base font-semibold text-ink">Ideal Customer Profile</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="industry">Industry</Label>
              <Input id="industry" name="industry" placeholder="Logistics" />
            </div>
            <div>
              <Label htmlFor="geography">Target geography</Label>
              <Input id="geography" name="geography" placeholder="West Africa" />
            </div>
            <div>
              <Label htmlFor="companySize">Ideal company size</Label>
              <Input id="companySize" name="companySize" placeholder="50-200 employees" />
            </div>
            <div>
              <Label htmlFor="targetRoles">Target roles (comma-separated)</Label>
              <Input id="targetRoles" name="targetRoles" placeholder="CEO, COO, Head of Operations" />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <h2 className="font-display text-base font-semibold text-ink">Offer</h2>
          <div>
            <Label htmlFor="offerDescription">What are you offering?</Label>
            <Textarea id="offerDescription" name="offerDescription" placeholder="Real-time freight visibility platform" />
          </div>
          <div>
            <Label htmlFor="valueProposition">Value proposition</Label>
            <Textarea id="valueProposition" name="valueProposition" placeholder="Cut manual tracking overhead during expansion" />
          </div>
          <div>
            <Label htmlFor="cta">Desired call to action</Label>
            <Input id="cta" name="cta" placeholder="Book a 15-minute call" />
          </div>
          <div>
            <Label htmlFor="researchInstructions">Additional research/personalization instructions (optional)</Label>
            <Textarea id="researchInstructions" name="researchInstructions" />
          </div>
        </CardBody>
      </Card>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create campaign"}
        </Button>
      </div>
    </form>
  );
}

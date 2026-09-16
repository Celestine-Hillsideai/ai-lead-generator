import Link from "next/link";
import { PageHeader } from "../../../components/layout/page-header";
import { Breadcrumbs } from "../../../components/layout/breadcrumbs";
import { Card, CardBody, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";

const STEPS = [
  {
    id: "create-campaign",
    title: "Create a campaign",
    summary: "Tell the app who you're selling to and what you're offering.",
  },
  {
    id: "get-leads",
    title: "Get your leads",
    summary: "Let the app find companies for you, or upload your own list.",
  },
  {
    id: "start-processing",
    title: "Start processing",
    summary: "One click runs research, contact discovery, scoring, and email drafting automatically.",
  },
  {
    id: "review-a-lead",
    title: "Review a lead",
    summary: "See exactly what was found about a company, and why it was scored the way it was.",
  },
  {
    id: "review-emails",
    title: "Review the email drafts",
    summary: "Approve, edit, regenerate, or reject — nothing sends without your say-so.",
  },
  {
    id: "set-up-sending",
    title: "Set up sending",
    summary: "Add your sender details once, then send approved emails.",
  },
  {
    id: "export",
    title: "Export your approved leads",
    summary: "Download a clean CSV of everyone you've approved.",
  },
];

const REFERENCE_SECTIONS = [
  { id: "statuses", title: "What the statuses mean" },
  { id: "tips", title: "Tips & good questions" },
  { id: "managing-campaigns", title: "Managing campaigns" },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <Breadcrumbs items={[{ label: "Getting started" }]} />
      <PageHeader
        title="Getting started"
        description="A short, practical walkthrough of the whole app, start to finish."
      />

      <Card className="mb-8">
        <CardBody className="space-y-3">
          <p className="text-sm text-ink">
            This app finds companies that match your ideal customer profile, researches them, finds a real
            decision-maker to contact, scores how good a fit they are, and drafts a personalized outreach email —
            citing real evidence for every claim it makes. You stay in control: nothing is sent until you approve it.
          </p>
          <p className="text-sm text-ink-muted">
            Jump to a step:{" "}
            {STEPS.map((step, i) => (
              <span key={step.id}>
                <a href={`#${step.id}`} className="text-accent-700 hover:underline">
                  {i + 1}. {step.title}
                </a>
                {i < STEPS.length - 1 ? " · " : ""}
              </span>
            ))}
          </p>
        </CardBody>
      </Card>

      <div className="space-y-6">
        <StepCard
          number={1}
          id="create-campaign"
          title="Create a campaign"
          action={
            <Link href="/campaigns/new">
              <Button size="sm">New campaign</Button>
            </Link>
          }
        >
          <p>
            A campaign is one outreach effort — one Ideal Customer Profile (ICP), one offer, one set of leads.
            From <strong>Campaigns → New campaign</strong>, fill in:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>ICP fields</strong> — industry, geography, company size, and the job titles you want to
              reach (e.g. CEO, Founder, Head of Operations). These drive both automatic company sourcing and
              lead scoring later.
            </li>
            <li>
              <strong>Offer, value proposition, and CTA</strong> — what you're selling and what you want the
              recipient to do. This is what every generated email is built around.
            </li>
            <li>
              <strong>Research instructions</strong> (optional) — anything extra you want the research step to
              pay attention to.
            </li>
          </ul>
          <p>Save it, and you'll land on the campaign's page, ready for the next step.</p>
        </StepCard>

        <StepCard number={2} id="get-leads" title="Get your leads">
          <p>You have two ways to build your company list — use either or both:</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <p className="font-medium text-ink">Find companies automatically</p>
              <p className="mt-1 text-ink-muted">
                Click this button and the app searches for real companies matching your campaign's ICP — no list
                required. Set how many to find, up to your campaign's limit.
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="font-medium text-ink">Import a CSV</p>
              <p className="mt-1 text-ink-muted">
                Already have a list? Upload a CSV with <code className="rounded bg-paper-sunken px-1">company_name</code> and{" "}
                <code className="rounded bg-paper-sunken px-1">website</code> columns (required), plus optional{" "}
                <code className="rounded bg-paper-sunken px-1">industry</code>,{" "}
                <code className="rounded bg-paper-sunken px-1">location</code>, and{" "}
                <code className="rounded bg-paper-sunken px-1">notes</code>.
              </p>
            </div>
          </div>
          <p>Both options are on the campaign page, and companies from either show up in the same leads table.</p>
        </StepCard>

        <StepCard number={3} id="start-processing" title="Start processing">
          <p>
            Once you have companies, click <strong>Start processing</strong>. For each company, the app
            automatically:
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Researches the company's own website and pulls out real, sourced findings.</li>
            <li>Looks for a real decision-maker (name, title, and email where one is genuinely available).</li>
            <li>Scores how well the company fits your ICP.</li>
            <li>Writes a personalized email, grounded in the specific findings from that company's own site.</li>
          </ol>
          <p>
            This takes a little time per company — you can watch progress live on the campaign page, and you can{" "}
            <strong>pause</strong> and <strong>resume</strong> at any point.
          </p>
        </StepCard>

        <StepCard number={4} id="review-a-lead" title="Review a lead">
          <p>
            Open any company from the leads table to see everything the app found: a company summary, the
            specific research findings it used (each one traceable to a real source), the qualification score
            breakdown, and the decision-maker it identified.
          </p>
          <p>
            Every factual claim about a company traces back to real evidence — click a finding to see exactly
            where it came from. Nothing here is guessed.
          </p>
        </StepCard>

        <StepCard number={5} id="review-emails" title="Review the email drafts">
          <p>
            Scroll down on a lead's page (or go to <strong>Approvals</strong> to review across every campaign at
            once) to see its generated email. For each draft you can:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Approve</strong> — mark it ready to send.
            </li>
            <li>
              <strong>Edit</strong> — change the subject or body yourself before approving.
            </li>
            <li>
              <strong>Regenerate</strong> — ask for a fresh draft using the same underlying research.
            </li>
            <li>
              <strong>Reject</strong> — decline it, keeping a record for your own history.
            </li>
            <li>
              <strong>Delete</strong> — remove a draft entirely if it's just noise you don't want cluttering the
              queue.
            </li>
          </ul>
          <p>
            On <strong>Approvals</strong>, you can also bulk-approve every high-confidence draft at once instead
            of going one by one.
          </p>
        </StepCard>

        <StepCard
          number={6}
          id="set-up-sending"
          title="Set up sending"
          action={
            <Link href="/settings">
              <Button size="sm" variant="secondary">
                Open Settings
              </Button>
            </Link>
          }
        >
          <p>
            Before you can send anything, add your sender name and email in <strong>Settings</strong> — this is
            what recipients will see the email come from. Once that's set, an <strong>Approved</strong> draft
            shows a <strong>Send</strong> button.
          </p>
          <p className="rounded-lg border border-accent-200 bg-accent-50 px-3 py-2 text-accent-700">
            Sending only ever happens when you click Send on a draft you've already approved — nothing goes out
            automatically.
          </p>
        </StepCard>

        <StepCard number={7} id="export" title="Export your approved leads">
          <p>
            From a campaign's page, click <strong>Export approved</strong> to download a CSV of every approved
            lead — useful for your own records or for importing into another tool.
          </p>
        </StepCard>
      </div>

      <div className="mt-10 space-y-6">
        <p className="text-sm text-ink-muted">
          More reference:{" "}
          {REFERENCE_SECTIONS.map((s, i) => (
            <span key={s.id}>
              <a href={`#${s.id}`} className="text-accent-700 hover:underline">
                {s.title}
              </a>
              {i < REFERENCE_SECTIONS.length - 1 ? " · " : ""}
            </span>
          ))}
        </p>

        <Card id="statuses">
          <CardHeader>
            <CardTitle>What the statuses mean</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4 text-sm">
            <div>
              <p className="mb-2 font-medium text-ink">A company moves through these stages automatically:</p>
              <p className="text-ink-muted">
                Imported → Researching → Researched → Finding contact → Contact found → Qualifying → Qualified →
                Writing email → <strong>Email ready</strong> (or <strong>Needs review</strong>, if the draft's
                confidence was low) → Approved.
              </p>
            </div>
            <div>
              <p className="mb-2 font-medium text-ink">Qualification tiers:</p>
              <div className="flex flex-wrap gap-2">
                <Badge tone="success">High fit</Badge>
                <Badge tone="warning">Medium fit</Badge>
                <Badge tone="neutral">Low fit</Badge>
                <Badge tone="danger">Unqualified</Badge>
              </div>
            </div>
            <div>
              <p className="mb-2 font-medium text-ink">Contact email status:</p>
              <p className="text-ink-muted">
                <strong>Verified</strong> and <strong>public</strong> mean an email was actually found or
                confirmed deliverable. <strong>Unknown</strong> means no real email could be found for that
                person — the app never invents or guesses one.
              </p>
            </div>
          </CardBody>
        </Card>

        <Card id="tips">
          <CardHeader>
            <CardTitle>Tips & good questions</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4 text-sm">
            <Faq q="Why does a lead have no contact email?">
              Most companies don't publish a named person's email address anywhere public. Rather than guess one
              (which would likely bounce or be wrong), the app leaves it honestly marked unknown. You'll still
              get a real name and title where one exists.
            </Faq>
            <Faq q="Can I trust the claims in an email?">
              Yes — every factual claim is required to trace back to a real finding from that company's own
              website, which you can inspect on the lead's page. The app is built to never fabricate facts.
            </Faq>
            <Faq q="What if a company was scored Unqualified?">
              You can still review and email them if you want — the score is guidance, not a gate. It's based on
              how well the company matches the ICP you defined for the campaign.
            </Faq>
            <Faq q="I deleted something by mistake — can I get it back?">
              Deleting a campaign or an email draft is permanent, which is why both ask you to confirm first.
              There's no undo, so double-check before confirming.
            </Faq>
          </CardBody>
        </Card>

        <Card id="managing-campaigns">
          <CardHeader>
            <CardTitle>Managing campaigns</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm text-ink-muted">
            <p>
              From the <strong>Campaigns</strong> list or a campaign's own page, you can pause and resume
              processing at any time, and delete a campaign you no longer need — this removes the campaign and
              everything under it (companies, research, contacts, and email drafts), so use it deliberately.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function StepCard({
  number,
  id,
  title,
  action,
  children,
}: {
  number: number;
  id: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card id={id}>
      <CardHeader className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-500 text-sm font-semibold text-white">
            {number}
          </span>
          <CardTitle>{title}</CardTitle>
        </div>
        {action}
      </CardHeader>
      <CardBody className="space-y-3 text-sm text-ink">{children}</CardBody>
    </Card>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-medium text-ink">{q}</p>
      <p className="mt-1 text-ink-muted">{children}</p>
    </div>
  );
}

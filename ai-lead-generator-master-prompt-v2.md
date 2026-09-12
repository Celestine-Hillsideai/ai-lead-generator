# AI Lead Generator — Claude Code Master Build Prompt

**Purpose:** Give Claude Code a complete, unambiguous specification to build a working AI-powered lead generation system end-to-end — from prospect sourcing through qualified handoff to sales/CRM.

**How to use this file:** Paste this entire document as your first message to Claude Code (or `claude` in your terminal) inside an empty project folder. Claude Code will scaffold the project, ask any clarifying questions flagged below, and build iteratively.

---

## 1. Project Overview

Build a modular **AI Lead Generation Pipeline** that:

1. Sources prospects matching an Ideal Customer Profile (ICP)
2. Enriches raw contact/company data
3. Scores and qualifies leads using AI
4. Generates personalized outreach copy per lead
5. Sequences multi-channel outreach (email first; LinkedIn/SMS optional)
6. Classifies inbound replies and routes them
7. Syncs qualified leads + activity history to a CRM
8. Logs conversion outcomes for a feedback loop that improves scoring/messaging over time

The system should run as a **modular pipeline** — each stage is an independent, testable unit that reads from and writes to a shared data store, so any stage can be swapped, re-run, or scaled independently.

---

## 2. Tech Stack (recommended defaults — Claude Code may confirm/adjust)

| Layer | Choice | Notes |
|---|---|---|
| Language | Python 3.11+ | Primary orchestration language |
| Orchestration | Prefect or plain async pipeline (no heavyweight orchestrator unless scale demands it) | Keep it simple for v1 |
| Data store | PostgreSQL (or SQLite for local/dev) | Single source of truth for lead state |
| LLM | Anthropic Claude API (`claude-sonnet-4-6` or latest) | For enrichment reasoning, scoring, copywriting, reply classification |
| Email sending | SMTP provider (e.g., Resend, Postmark, or SES) | Pluggable interface |
| CRM sync | HubSpot API (default) — abstracted behind an interface so Pipedrive/other CRMs can be swapped in | |
| Scraping/sourcing | Apollo.io API or Clay (as external enrichment source) — abstracted behind a `LeadSource` interface | |
| Scheduling | Cron / simple task queue for sequencing follow-ups | |
| Config | `.env` file + `config.yaml` for ICP criteria, scoring weights, sequence timing | |

**Ask the user before building** if any of these differ from what's actually available (API keys, CRM in use, email provider).

---

## 3. Data Model

Create a `leads` table (or equivalent) with this minimum schema:

```
lead_id            UUID (PK)
first_name         TEXT
last_name          TEXT
title              TEXT
company_name       TEXT
company_domain     TEXT
industry           TEXT
company_size       INT
location            TEXT
email              TEXT
linkedin_url       TEXT
source             TEXT            -- where the lead came from
enrichment_data    JSONB           -- raw enrichment payload
intent_signals     JSONB           -- e.g. hiring, funding, news
fit_score          FLOAT           -- 0-100, ICP fit
intent_score       FLOAT           -- 0-100, buying signal strength
composite_score    FLOAT           -- weighted combination
qualification      TEXT            -- 'qualified' | 'nurture' | 'disqualified'
outreach_status    TEXT            -- 'not_started' | 'sequenced' | 'replied' | 'booked' | 'closed_won' | 'closed_lost'
last_message_sent  TIMESTAMP
reply_classification TEXT          -- 'interested' | 'not_now' | 'objection' | 'ooo' | 'unsubscribe' | null
crm_id             TEXT            -- external CRM record ID once synced
created_at         TIMESTAMP
updated_at         TIMESTAMP
```

Also create an `activity_log` table capturing every event (email sent, reply received, score change, status change) with `lead_id`, `event_type`, `payload`, `timestamp` — this is what feeds the feedback loop later.

---

## 4. Pipeline Stages — Build Each as an Independent Module

### Stage 1 — Source
- Module: `source.py`
- Input: ICP config (industry, company size range, title keywords, location, etc. — defined in `config.yaml`)
- Output: raw lead records inserted into `leads` table with `source` populated
- Interface: `LeadSource.fetch(icp_criteria) -> list[RawLead]` so different providers (Apollo, Clay, CSV import, manual list) can be swapped in without touching downstream code

### Stage 2 — Enrich
- Module: `enrich.py`
- For each new lead, call enrichment provider(s) to fill: verified email, company tech stack, recent funding/news, headcount, social activity
- Use Claude to synthesize enrichment signals into a short structured summary (2-3 sentences) stored in `enrichment_data.summary` — this becomes context for scoring and copywriting later
- Handle rate limits and partial failures gracefully (don't block the whole batch on one bad lookup)

### Stage 3 — Score & Qualify
- Module: `score.py`
- Compute `fit_score` (how well the lead matches ICP — deterministic, rules-based from config weights)
- Compute `intent_score` using Claude: pass the enrichment summary + intent signals, ask for a 0-100 intent score with reasoning, using a **fixed rubric** you define in the prompt (e.g., recent hiring in relevant function = +20, funding round in last 6 months = +15, etc.)
- `composite_score = (fit_score * fit_weight) + (intent_score * intent_weight)` — weights configurable
- Apply qualification thresholds (e.g., ≥70 = qualified, 40-69 = nurture, <40 = disqualified) — configurable in `config.yaml`
- **Important:** Always have Claude return structured JSON (score + short justification) — never free text — so it's parseable and auditable

### Stage 4 — Personalize Outreach
- Module: `personalize.py`
- For each qualified lead, generate a first-touch email using Claude with:
  - The enrichment summary as context
  - A brand voice/style guide (pull from `config.yaml` — company name, tone, value proposition, CTA)
  - Strict output format: subject line + body, plain text, no markdown
  - A hard constraint: reference at least one specific, real fact about the lead/company (from enrichment) — reject and regenerate if the output is generic
- Store the generated draft; allow a human-review flag (`config.yaml` toggle) before sending in v1

### Stage 5 — Sequence
- Module: `sequence.py`
- Define a sequence config (e.g., Day 0 email 1 → Day 3 follow-up if no reply → Day 7 breakup email)
- Scheduler checks `outreach_status` and `last_message_sent` daily, sends the next message in sequence via the email provider interface
- Stop sequencing immediately on any reply, bounce, or unsubscribe

### Stage 6 — Reply Handling
- Module: `reply_handler.py`
- Ingest replies (via inbox webhook or polling)
- Use Claude to classify each reply into: `interested`, `not_now`, `objection`, `ooo`, `unsubscribe`, `other` — structured JSON output only
- On `interested`: draft a suggested response and/or trigger a "book a call" action; flag for human review by default
- On `unsubscribe`: immediately halt sequencing and mark the lead
- Log every classification to `activity_log`

### Stage 7 — CRM Sync
- Module: `crm_sync.py`
- Interface: `CRMConnector.upsert_lead(lead) -> crm_id`
- Push qualified leads + full activity history to CRM on qualification and on major status changes
- Idempotent — safe to re-run without creating duplicates

### Stage 8 — Feedback Loop
- Module: `feedback.py`
- Weekly job that pulls closed-won/closed-lost outcomes from CRM, joins against original `fit_score`/`intent_score`/enrichment data
- Outputs a report (which ICP segments and intent signals actually converted) — v1 can be a simple summary; do not auto-adjust scoring weights without human review

---

## 5. Project Structure

```
ai-lead-generator/
├── config.yaml              # ICP criteria, scoring weights, sequence timing, brand voice
├── .env.example              # API keys template
├── pyproject.toml
├── src/
│   ├── source.py
│   ├── enrich.py
│   ├── score.py
│   ├── personalize.py
│   ├── sequence.py
│   ├── reply_handler.py
│   ├── crm_sync.py
│   ├── feedback.py
│   ├── db/
│   │   ├── models.py
│   │   └── migrations/
│   ├── integrations/
│   │   ├── lead_sources/     # Apollo, Clay, CSV, etc. — each implements LeadSource
│   │   ├── crm/               # HubSpot, Pipedrive, etc. — each implements CRMConnector
│   │   └── email/             # SMTP provider wrapper
│   └── llm/
│       └── claude_client.py   # Shared Claude API wrapper with retry/backoff
├── tests/
│   └── (unit tests per module, with mocked API responses)
└── README.md
```

---

## 6. Claude API Usage Rules (apply across all stages)

- Always request **structured JSON output** for scoring and classification tasks — never parse free text
- Include a fixed, versioned rubric/prompt template per task (store in `src/llm/prompts/`) so behavior is auditable and consistent across runs
- Set low temperature (0–0.3) for scoring/classification; moderate temperature (0.5–0.7) for outreach copywriting
- Wrap every Claude call with retry + exponential backoff and a max-token budget guard
- Never send full enrichment payloads verbatim if they contain sensitive personal data beyond what's needed — pass only the fields relevant to the task

---

## 7. Build Order (tell Claude Code to build in this sequence)

1. Scaffold project structure + `config.yaml` + `.env.example` + DB models/migrations
2. Build `source.py` with a CSV-import `LeadSource` first (fastest to test end-to-end without live API keys), then add the real provider
3. Build `enrich.py` and `score.py` together — these are the core AI reasoning stages, test with 5-10 sample leads
4. Build `personalize.py` — test output quality manually before wiring to send
5. Build `sequence.py` + email integration — start with a dry-run mode that logs instead of sending
6. Build `reply_handler.py`
7. Build `crm_sync.py`
8. Build `feedback.py` last, once there's real outcome data to work with
9. Write a `README.md` with setup instructions and a `make run-pipeline` (or equivalent) command that runs the full flow end-to-end on a batch

At each stage, **write unit tests with mocked API responses** — do not require live API keys to run the test suite.

---

## 8. Open Questions Claude Code Should Ask Before Building

- Which lead source(s) does the user already have API access to (Apollo, Clay, LinkedIn Sales Navigator, other)?
- Which CRM is actually in use (HubSpot, Pipedrive, other, or none yet)?
- Which email sending provider/account should be used?
- Should outreach send automatically after generation, or require human approval per message (recommended default: approval required in v1)?
- What is the ICP (industry, company size, geography, titles) to hardcode into the initial `config.yaml`?
- Brand voice/tone reference material (existing outreach templates, website copy, or brand guidelines) to ground the personalization prompts?

---

## 9. Success Criteria for v1

- End-to-end run on a CSV of 20 sample leads produces: enriched records, scores with justifications, qualification labels, and draft personalized emails — without errors
- All Claude calls return valid, parseable structured output
- Full activity history is queryable per lead
- CRM sync is idempotent and does not duplicate records on re-run
- Reply classification correctly separates `interested`/`unsubscribe`/`other` on a small test set of sample replies

---

*End of master prompt. Paste this whole document to Claude Code to begin the build.*

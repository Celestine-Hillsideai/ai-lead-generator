/**
 * Uploads env vars to a Trigger.dev environment (prod by default), using
 * the SDK's management API (@trigger.dev/sdk's `envvars` module) rather
 * than the dashboard -- the CLI itself has no `env set`, only
 * `list`/`get`/`pull` (see workflows/05-env-vars.md), but the SDK exposes
 * `envvars.upload()` which authenticates the same way `tasks.trigger()`
 * does (TRIGGER_SECRET_KEY for that environment).
 *
 * Reads values from the current process env (source .env.local first, or
 * export them another way) and pushes a curated list -- blank/unset values
 * are skipped rather than uploaded as empty strings. Secrets and
 * non-secret config vars are uploaded in two separate calls, since
 * envvars.upload()'s `isSecret` flag applies to the whole batch, not
 * per-variable.
 *
 * IMPORTANT: `--env`/the `slug` argument does NOT redirect which
 * environment gets written -- a TRIGGER_SECRET_KEY is itself scoped to one
 * environment (dev or prod), and that's what actually determines the
 * target; passing --env prod while authenticated with the dev key silently
 * writes to dev instead (no error). .env.local's own TRIGGER_SECRET_KEY is
 * the dev key, so syncing to prod requires an explicit override:
 *
 *   set -a; source .env.local; set +a
 *   TRIGGER_SECRET_KEY=<the prod secret key> npx tsx tools/sync-trigger-env.ts --env prod
 *
 * Verify with `envvars.retrieve(...)` (using the same explicit prod key)
 * after syncing -- don't trust this script's own trailing list() call as
 * proof of which environment was actually written, since it's reading back
 * through the same (possibly wrong) key.
 *
 * Usage:
 *   set -a; source .env.local; set +a   # loads TRIGGER_SECRET_KEY etc.
 *   npx tsx tools/sync-trigger-env.ts [--env prod|dev]
 */

import { envvars } from "@trigger.dev/sdk";

const PROJECT_REF = "proj_lnazyzacybswreyturun";

const SECRET_VARS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "SEARCH_API_KEY",
  "SOURCING_API_KEY",
  "RESEND_API_KEY",
];

const CONFIG_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SOURCING_PROVIDER",
  "MOCK_AI",
  "MOCK_SEARCH",
  "MOCK_SOURCING",
  "MOCK_EMAIL",
  "MAX_PAGES_PER_COMPANY",
  "MAX_COMPANIES_PER_CAMPAIGN",
  "MAX_COMPANIES_PER_SOURCING_RUN",
  "MAX_AGENT_RETRIES",
  "MAX_CONCURRENT_REQUESTS",
];

function collect(names: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && value !== "") result[name] = value;
  }
  return result;
}

async function main() {
  const envFlagIndex = process.argv.indexOf("--env");
  const environmentSlug = envFlagIndex !== -1 ? process.argv[envFlagIndex + 1] : "prod";
  if (!environmentSlug) throw new Error("Usage: --env prod|dev");

  const secrets = collect(SECRET_VARS);
  const config = collect(CONFIG_VARS);

  console.log(`Syncing to Trigger.dev environment "${environmentSlug}":`);
  console.log(`  secret vars:  ${Object.keys(secrets).join(", ") || "(none set)"}`);
  console.log(`  config vars:  ${Object.keys(config).join(", ") || "(none set)"}`);

  if (Object.keys(secrets).length > 0) {
    await envvars.upload(PROJECT_REF, environmentSlug, { variables: secrets, override: true, isSecret: true });
  }
  if (Object.keys(config).length > 0) {
    await envvars.upload(PROJECT_REF, environmentSlug, { variables: config, override: true, isSecret: false });
  }

  const current = await envvars.list(PROJECT_REF, environmentSlug);
  console.log(`\nEnvironment "${environmentSlug}" now has ${current.length} var(s): ${current.map((v) => v.name).join(", ")}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

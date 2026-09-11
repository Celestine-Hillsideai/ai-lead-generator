import type { EmailProvider } from "./types";
import { MockEmailProvider } from "./mock";
import { ResendEmailProvider } from "./resend";

export type { EmailProvider, SendEmailInput, SendEmailResult } from "./types";

export interface EmailProviderOverride {
  provider?: "mock" | "resend";
}

/**
 * Per docs/spec.md §20: "Sending must be disabled unless explicitly
 * configured." MOCK_EMAIL defaults to "true" in .env.example -- a real
 * send only happens if MOCK_EMAIL is explicitly set to "false" AND
 * RESEND_API_KEY is present. There is no third state that accidentally
 * sends real email. MOCK_EMAIL is the global kill switch and always wins;
 * `override` (a user's saved emailProvider setting, per types/settings.ts)
 * only matters once MOCK_EMAIL=false, and can still choose "mock" there.
 */
export function getEmailProvider(override?: EmailProviderOverride): EmailProvider {
  if (process.env.MOCK_EMAIL !== "false") {
    return new MockEmailProvider();
  }

  if (override?.provider === "mock") {
    return new MockEmailProvider();
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required when MOCK_EMAIL=false.");
  }
  return new ResendEmailProvider(apiKey);
}

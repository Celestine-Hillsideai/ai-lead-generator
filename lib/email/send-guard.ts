/**
 * Pure send-eligibility check, per docs/spec.md §20: "Never send to
 * suppressed, unsubscribed, or invalid contacts." Kept separate from
 * app/actions/emails.ts (which does the actual Supabase reads) so this
 * decision logic is unit-testable without a live DB.
 */

export interface SendGuardContact {
  email: string | null;
  emailStatus: string | null;
}

export interface SendGuardResult {
  allowed: boolean;
  reason?: string;
}

export function checkSendEligibility(contact: SendGuardContact | null, suppressedEmails: string[]): SendGuardResult {
  if (!contact || !contact.email) {
    return { allowed: false, reason: "No recipient email address on file for this draft." };
  }

  if (contact.emailStatus === "invalid") {
    return { allowed: false, reason: "Recipient email is marked invalid." };
  }

  const normalized = contact.email.trim().toLowerCase();
  const suppressed = suppressedEmails.some((s) => s.trim().toLowerCase() === normalized);
  if (suppressed) {
    return { allowed: false, reason: "Recipient is on the suppression/do-not-contact list." };
  }

  return { allowed: true };
}

import { describe, expect, it } from "vitest";
import { checkSendEligibility } from "../../lib/email/send-guard";

describe("checkSendEligibility", () => {
  it("blocks when there is no contact on file", () => {
    const result = checkSendEligibility(null, []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/no recipient/i);
  });

  it("blocks when the contact has no email address", () => {
    const result = checkSendEligibility({ email: null, emailStatus: "unknown" }, []);
    expect(result.allowed).toBe(false);
  });

  it("blocks contacts with an invalid email status", () => {
    const result = checkSendEligibility({ email: "jane@example.com", emailStatus: "invalid" }, []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/invalid/i);
  });

  it("blocks emails on the suppression list, case-insensitively", () => {
    const result = checkSendEligibility(
      { email: "Jane@Example.com", emailStatus: "verified" },
      ["jane@example.com"]
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/suppression/i);
  });

  it("allows a verified, non-suppressed contact", () => {
    const result = checkSendEligibility({ email: "jane@example.com", emailStatus: "verified" }, ["other@example.com"]);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it.each(["public", "unverified", "unknown"])("allows a %s (non-invalid, non-suppressed) contact", (status) => {
    const result = checkSendEligibility({ email: "jane@example.com", emailStatus: status }, []);
    expect(result.allowed).toBe(true);
  });
});

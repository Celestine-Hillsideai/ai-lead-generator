import { afterEach, describe, expect, it, vi } from "vitest";
import { getEmailProvider } from "../../lib/email";
import { MockEmailProvider } from "../../lib/email/mock";
import { ResendEmailProvider } from "../../lib/email/resend";

describe("getEmailProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns MockEmailProvider whenever MOCK_EMAIL is not explicitly 'false' (the default, safe state)", () => {
    vi.stubEnv("MOCK_EMAIL", "true");
    expect(getEmailProvider()).toBeInstanceOf(MockEmailProvider);

    vi.stubEnv("MOCK_EMAIL", "");
    expect(getEmailProvider()).toBeInstanceOf(MockEmailProvider);
  });

  it("returns ResendEmailProvider when MOCK_EMAIL='false' and RESEND_API_KEY is set", () => {
    vi.stubEnv("MOCK_EMAIL", "false");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    expect(getEmailProvider()).toBeInstanceOf(ResendEmailProvider);
  });

  it("throws when MOCK_EMAIL='false' but RESEND_API_KEY is missing", () => {
    vi.stubEnv("MOCK_EMAIL", "false");
    vi.stubEnv("RESEND_API_KEY", "");
    expect(() => getEmailProvider()).toThrow(/RESEND_API_KEY/);
  });

  it("honors an explicit 'mock' override even when MOCK_EMAIL='false' (per-user opt-out)", () => {
    vi.stubEnv("MOCK_EMAIL", "false");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    expect(getEmailProvider({ provider: "mock" })).toBeInstanceOf(MockEmailProvider);
  });

  it("MOCK_EMAIL still wins over a 'resend' override (global kill switch)", () => {
    vi.stubEnv("MOCK_EMAIL", "true");
    expect(getEmailProvider({ provider: "resend" })).toBeInstanceOf(MockEmailProvider);
  });
});

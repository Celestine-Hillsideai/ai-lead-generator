import type { EmailProvider, SendEmailInput, SendEmailResult } from "./types";

/** Deterministic mock, per docs/spec.md §29 (MOCK_EMAIL=true, the safe default). Never sends anything. */
export class MockEmailProvider implements EmailProvider {
  readonly name = "mock";

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    return {
      success: true,
      providerMessageId: `mock-${input.campaignId}-${input.contactId}`,
    };
  }
}

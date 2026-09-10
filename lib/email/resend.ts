import { Resend } from "resend";
import type { EmailProvider, SendEmailInput, SendEmailResult } from "./types";

/** Resend implementation, per docs/spec.md §20. */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  private client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const result = await this.client.emails.send({
      to: input.to,
      from: input.from,
      subject: input.subject,
      text: input.body,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }
    return { success: true, providerMessageId: result.data?.id };
  }
}

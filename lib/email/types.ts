/** EmailProvider interface, verbatim from docs/spec.md §20. */

export interface SendEmailInput {
  to: string;
  from: string;
  subject: string;
  body: string;
  /** Used to honor unsubscribe/suppression -- checked by the caller before invoking send(), not by the provider itself. */
  campaignId: string;
  contactId: string;
}

export interface SendEmailResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(input: SendEmailInput): Promise<SendEmailResult>;
}

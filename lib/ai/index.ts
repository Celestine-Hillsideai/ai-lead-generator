import type { AIProvider } from "./types";
import { MockAIProvider } from "./mock";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";

export type { AIProvider, GenerateJsonParams } from "./types";
export { generateStructuredOutput, MalformedAIResponseError } from "./generate-structured";

export interface AIProviderOverride {
  provider?: "openai" | "anthropic";
  model?: string | null;
}

/**
 * Provider factory, per docs/spec.md §5, §29. Selection order:
 *   1. MOCK_AI=true -> MockAIProvider (deterministic, no API calls)
 *   2. `override` (a user's saved settings, per types/settings.ts -- see
 *      trigger/research-workflow.ts, which passes the campaign owner's
 *      choice through here)
 *   3. AI_PROVIDER env var ("openai" | "anthropic"), default "openai"
 */
export function getAIProvider(override?: AIProviderOverride): AIProvider {
  if (process.env.MOCK_AI === "true") {
    return new MockAIProvider();
  }

  const providerName = override?.provider ?? process.env.AI_PROVIDER ?? "openai";

  if (providerName === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic and MOCK_AI is not true.");
    return new AnthropicProvider(apiKey, override?.model ?? undefined);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required when AI_PROVIDER=openai (the default) and MOCK_AI is not true.");
  return new OpenAIProvider(apiKey, override?.model ?? undefined);
}

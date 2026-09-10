import type { AgentType } from "../../types/status";

/**
 * Provider abstraction for AI calls, per docs/spec.md §5: "provider
 * abstraction supporting Anthropic and OpenAI; production model can be
 * selected through configuration." Every agent (agents/*.ts) calls this
 * interface, never the OpenAI/Anthropic SDKs directly -- that keeps the
 * provider swap (and mocking, per spec §29) at one seam.
 */
export interface GenerateJsonParams {
  /** Which agent is calling -- lets MockAIProvider return the right canned shape. */
  agentType: AgentType;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}

export interface AIProvider {
  readonly name: string;
  /** Returns the raw text response -- expected to be JSON per the prompt's instructions, but not parsed/validated here. */
  generateJson(params: GenerateJsonParams): Promise<string>;
}

import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, GenerateJsonParams } from "./types";

/**
 * Secondary AI provider path, per docs/spec.md §5. Claude has no dedicated
 * "JSON mode" API flag the way OpenAI does, so the system prompt is
 * strengthened with an explicit JSON-only instruction; the Zod-validate +
 * repair-retry loop in lib/ai/generate-structured.ts is what actually
 * enforces correctness, same as for the OpenAI path.
 */
export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5") {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async generateJson(params: GenerateJsonParams): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: params.maxTokens ?? 2000,
      system: `${params.systemPrompt}\n\nRespond with ONLY a single valid JSON object. No markdown code fences, no commentary before or after.`,
      messages: [{ role: "user", content: params.userPrompt }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Anthropic response had no text content");
    }
    return textBlock.text;
  }
}

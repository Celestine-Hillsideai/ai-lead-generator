import OpenAI from "openai";
import type { AIProvider, GenerateJsonParams } from "./types";

/**
 * Primary/default AI provider for this build (per project decision -- spec
 * §5 requires the abstraction support both OpenAI and Anthropic, this repo
 * defaults to OpenAI). Uses JSON mode so the model is constrained to emit a
 * single JSON object; agents still Zod-validate the result themselves --
 * JSON mode guarantees syntactically valid JSON, not that it matches the
 * expected shape.
 */
export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = process.env.OPENAI_MODEL ?? "gpt-4o-mini") {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async generateJson(params: GenerateJsonParams): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: params.maxTokens ?? 2000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI response had no content");
    }
    return content;
  }
}

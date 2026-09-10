import type { ZodType, ZodTypeDef } from "zod";
import type { AIProvider, GenerateJsonParams } from "./types";

/**
 * Shared "call the model, validate, repair-and-retry on malformed output"
 * loop, per docs/spec.md §22: "Validate every model response with Zod.
 * Retry malformed outputs using a constrained repair strategy." Every agent
 * uses this instead of hand-rolling its own parse/retry logic, so the retry
 * behavior (and its bound) is consistent and tested once.
 */

export class MalformedAIResponseError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastRawResponse: string
  ) {
    super(message);
    this.name = "MalformedAIResponseError";
  }
}

export interface GenerateStructuredOptions<T> extends GenerateJsonParams {
  // Input is intentionally decoupled from T (rather than using zod's
  // ZodSchema<T> alias, which binds Input=Output=T) -- with that alias, a
  // schema containing a .default() field infers T as the wider "input"
  // shape (fields optional) instead of the narrower "output" shape (fields
  // required after defaulting), which breaks agents returning the output type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberate, see comment above
  schema: ZodType<T, ZodTypeDef, any>;
  maxAttempts?: number;
}

export async function generateStructuredOutput<T>(
  provider: AIProvider,
  options: GenerateStructuredOptions<T>
): Promise<T> {
  const { schema, maxAttempts = 3, ...baseParams } = options;

  let lastRaw = "";
  let lastErrorMessage = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const userPrompt =
      attempt === 1
        ? baseParams.userPrompt
        : `${baseParams.userPrompt}\n\nYour previous response failed validation with this error:\n${lastErrorMessage}\n\nYour previous response was:\n${lastRaw}\n\nRespond again with ONLY a corrected, valid JSON object matching the required schema. Do not repeat the same mistake.`;

    const raw = await provider.generateJson({ ...baseParams, userPrompt });
    lastRaw = raw;

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch (err) {
      lastErrorMessage = `Response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`;
      continue;
    }

    const result = schema.safeParse(parsedJson);
    if (result.success) {
      return result.data;
    }

    lastErrorMessage = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
  }

  throw new MalformedAIResponseError(
    `AI response failed schema validation after ${maxAttempts} attempts: ${lastErrorMessage}`,
    maxAttempts,
    lastRaw
  );
}

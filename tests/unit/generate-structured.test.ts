import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { generateStructuredOutput, MalformedAIResponseError } from "../../lib/ai/generate-structured";
import type { AIProvider, GenerateJsonParams } from "../../lib/ai/types";

const schema = z.object({ name: z.string(), score: z.number().min(0).max(100) });

function fakeProvider(responses: string[]): AIProvider {
  let call = 0;
  return {
    name: "fake",
    generateJson: vi.fn(async (_params: GenerateJsonParams) => {
      const response = responses[Math.min(call, responses.length - 1)]!;
      call++;
      return response;
    }),
  };
}

describe("generateStructuredOutput", () => {
  it("returns parsed data on the first valid response", async () => {
    const provider = fakeProvider(['{"name":"Acme","score":80}']);
    const result = await generateStructuredOutput(provider, {
      agentType: "qualification",
      systemPrompt: "sys",
      userPrompt: "user",
      schema,
    });
    expect(result).toEqual({ name: "Acme", score: 80 });
    expect(provider.generateJson).toHaveBeenCalledTimes(1);
  });

  it("retries on invalid JSON, then succeeds", async () => {
    const provider = fakeProvider(["not json at all", '{"name":"Acme","score":80}']);
    const result = await generateStructuredOutput(provider, {
      agentType: "qualification",
      systemPrompt: "sys",
      userPrompt: "user",
      schema,
    });
    expect(result).toEqual({ name: "Acme", score: 80 });
    expect(provider.generateJson).toHaveBeenCalledTimes(2);
  });

  it("retries on schema-invalid JSON (out of range score), then succeeds", async () => {
    const provider = fakeProvider(['{"name":"Acme","score":500}', '{"name":"Acme","score":80}']);
    const result = await generateStructuredOutput(provider, {
      agentType: "qualification",
      systemPrompt: "sys",
      userPrompt: "user",
      schema,
    });
    expect(result).toEqual({ name: "Acme", score: 80 });
  });

  it("includes the previous error in the retry prompt", async () => {
    const provider = fakeProvider(["not json", '{"name":"Acme","score":80}']);
    await generateStructuredOutput(provider, {
      agentType: "qualification",
      systemPrompt: "sys",
      userPrompt: "user",
      schema,
    });
    const secondCallArgs = (provider.generateJson as ReturnType<typeof vi.fn>).mock.calls[1]![0] as GenerateJsonParams;
    expect(secondCallArgs.userPrompt).toContain("failed validation");
  });

  it("throws MalformedAIResponseError after exhausting maxAttempts", async () => {
    const provider = fakeProvider(["still not json"]);
    await expect(
      generateStructuredOutput(provider, {
        agentType: "qualification",
        systemPrompt: "sys",
        userPrompt: "user",
        schema,
        maxAttempts: 2,
      })
    ).rejects.toThrow(MalformedAIResponseError);
    expect(provider.generateJson).toHaveBeenCalledTimes(2);
  });
});

import { describe, expect, it } from "vitest";
import { generateText } from "ai";
import { createAssistantModel } from "./openrouter";
import { effectiveReasoning, parseReasoningEffort, reasoningChoices } from "./models";

async function sentBody(modelId: string, reasoningEffort?: Parameters<typeof createAssistantModel>[0]["reasoningEffort"]) {
  let body: Record<string, unknown> = {};
  const fetchFn = (async (_url: unknown, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        id: "g",
        object: "chat.completion",
        created: 1,
        model: modelId,
        choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
      }),
      { headers: { "content-type": "application/json" } }
    );
  }) as unknown as typeof fetch;
  const model = createAssistantModel({ apiKey: "k", modelId, privacyOnly: false, fetch: fetchFn, reasoningEffort });
  await generateText({ model, prompt: "hi" });
  return body;
}

describe("reasoning effort", () => {
  it("offers Off only where reasoning is optional", () => {
    expect(reasoningChoices({ reasoning: "optional" })).toContain("none");
    expect(reasoningChoices({ reasoning: "mandatory" })).not.toContain("none");
    expect(reasoningChoices()).toContain("none");
  });

  it("falls back to default for a choice the model cannot take", () => {
    expect(effectiveReasoning("none", { reasoning: "mandatory" })).toBe("default");
    expect(effectiveReasoning("high", { reasoning: "mandatory" })).toBe("high");
  });

  it("reads stored values defensively", () => {
    expect(parseReasoningEffort("medium")).toBe("medium");
    expect(parseReasoningEffort("extreme")).toBe("default");
    expect(parseReasoningEffort(undefined)).toBe("default");
  });

  it("sends nothing by default", async () => {
    expect((await sentBody("anthropic/claude-sonnet-5.5")).reasoning).toBeUndefined();
    expect((await sentBody("anthropic/claude-sonnet-5.5", "default")).reasoning).toBeUndefined();
  });

  it("sends the chosen effort to OpenRouter", async () => {
    expect((await sentBody("anthropic/claude-sonnet-5.5", "high")).reasoning).toEqual({ effort: "high" });
    expect((await sentBody("deepseek/deepseek-v4.1-flash-1017", "none")).reasoning).toEqual({ effort: "none" });
  });

  it("does not send Off to a model that must reason", async () => {
    expect((await sentBody("anthropic/claude-sonnet-5.5", "none")).reasoning).toBeUndefined();
  });
});

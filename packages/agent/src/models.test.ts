import { describe, expect, it } from "vitest";
import {
  checkSuggested,
  costFromUsage,
  DEFAULT_MODEL_ID,
  intelligenceLevel,
  latestModels,
  modelFamily,
  modelsListUrl,
  parseModelList,
  priceLevel,
  routingPreferences,
  SUGGESTED_MODELS
} from "./models";
import { buildAuthUrl, createPkce, exchangeCode } from "./oauth";
import { looksLikeKey, maskKey, redactKeys } from "./openrouter";

describe("suggested models", () => {
  it("has a valid default and three models per tier, no duplicates", () => {
    expect(SUGGESTED_MODELS.some((m) => m.id === DEFAULT_MODEL_ID)).toBe(true);
    for (const tier of ["low", "balanced", "quality"] as const) {
      expect(SUGGESTED_MODELS.filter((m) => m.tier === tier)).toHaveLength(3);
    }
    expect(new Set(SUGGESTED_MODELS.map((m) => m.id)).size).toBe(SUGGESTED_MODELS.length);
  });

  it("never allows mandatory reasoning in the low tier", () => {
    expect(SUGGESTED_MODELS.filter((m) => m.tier === "low").every((m) => m.reasoning === "optional")).toBe(true);
  });

  it("never pins an alias", () => {
    expect(SUGGESTED_MODELS.some((m) => m.id.startsWith("~"))).toBe(false);
  });

  it("drops ids that are missing, expired, or lost tool support", () => {
    const live = parseModelList({
      data: [
        { id: SUGGESTED_MODELS[0]!.id, name: "A", context_length: 1, pricing: { prompt: "0.000001", completion: "0.000002" }, supported_parameters: ["tools"] },
        { id: SUGGESTED_MODELS[1]!.id, supported_parameters: ["tools"], expiration_date: "2020-01-01" },
        { id: SUGGESTED_MODELS[2]!.id, supported_parameters: [] }
      ]
    });
    const { usable, dropped } = checkSuggested(SUGGESTED_MODELS.slice(0, 4), live);
    expect(usable.map((m) => m.id)).toEqual([SUGGESTED_MODELS[0]!.id]);
    expect(dropped.map((d) => d.reason)).toEqual(["expired", "no tool calling", "not in the live model list"]);
  });

  it("reads the intelligence index and grades price and intelligence from 1 to 5", () => {
    const [a, b] = parseModelList({
      data: [
        { id: "a", pricing: { prompt: "0.0000001", completion: "0.0000005" }, benchmarks: { artificial_analysis: { intelligence_index: 54.5 } } },
        { id: "b", pricing: { prompt: "0.00001", completion: "0.00005" } }
      ]
    });
    expect(a!.intelligence).toBe(54.5);
    expect(b!.intelligence).toBeNull();
    expect(intelligenceLevel(a!)).toBe(5);
    expect(intelligenceLevel(b!)).toBeNull();
    expect(priceLevel(a!)).toBe(2);
    expect(priceLevel(b!)).toBe(5);
    expect(intelligenceLevel({ intelligence: 10 })).toBe(1);
    expect(intelligenceLevel({ intelligence: 33 })).toBe(3);
  });

  it("estimates a missing intelligence index from the agentic index and from the base model", () => {
    const data = Array.from({ length: 10 }, (_, i) => ({
      id: `m${i}`,
      benchmarks: { artificial_analysis: { intelligence_index: 10 + i * 4, agentic_index: 12 + i * 5 } }
    }));
    data.push({ id: "x", benchmarks: { artificial_analysis: { intelligence_index: null, agentic_index: 32 } } } as never);
    data.push({ id: "m9:batch" } as never);
    const live = parseModelList({ data });
    const x = live.find((m) => m.id === "x")!;
    expect(x.intelligenceEstimated).toBe(true);
    expect(x.intelligence).toBeGreaterThan(25);
    expect(x.intelligence).toBeLessThan(35);
    const batch = live.find((m) => m.id === "m9:batch")!;
    expect(batch.intelligence).toBe(46);
    expect(batch.intelligenceEstimated).toBe(false);
    expect(live.find((m) => m.id === "m0")!.intelligenceEstimated).toBe(false);
  });

  it("keeps only the newest model of each line", () => {
    const mk = (id: string, created: number) => ({ id, created, supported_parameters: ["tools"] });
    const live = parseModelList({
      data: [
        mk("anthropic/claude-sonnet-4.5", 1),
        mk("anthropic/claude-sonnet-5.5", 3),
        mk("anthropic/claude-sonnet-5", 2),
        mk("anthropic/claude-sonnet-5.5:batch", 4),
        mk("~anthropic/claude-sonnet-latest", 9),
        mk("anthropic/claude-haiku-5.5", 3),
        mk("openai/gpt-6-luna", 5),
        mk("openai/gpt-5.6-luna", 4),
        mk("openai/gpt-6.1-terra", 6)
      ]
    });
    expect(modelFamily("anthropic/claude-sonnet-4.5")).toBe("anthropic/claude-sonnet");
    expect(modelFamily("qwen/qwen3.8-max-0902")).toBe("qwen/qwen-max");
    const ids = latestModels(live, new Set(["anthropic/claude-sonnet-4.5"])).map((m) => m.id);
    expect(ids).toEqual([
      "anthropic/claude-sonnet-4.5",
      "anthropic/claude-sonnet-5.5",
      "anthropic/claude-haiku-5.5",
      "openai/gpt-6-luna",
      "openai/gpt-6.1-terra"
    ]);
  });

  it("parses garbage as an empty list", () => {
    expect(parseModelList(null)).toEqual([]);
    expect(parseModelList({ data: "x" })).toEqual([]);
  });

  it("computes cost and routing preferences", () => {
    expect(costFromUsage({ inputTokens: 1000, outputTokens: 100 }, { promptPrice: 1e-6, completionPrice: 2e-6 })).toBeCloseTo(0.0012);
    expect(costFromUsage({ inputTokens: 1, outputTokens: 1 }, null)).toBeNull();
    expect(routingPreferences({ noTraining: true, zdr: false })).toEqual({ data_collection: "deny" });
    expect(routingPreferences({ noTraining: false, zdr: true })).toEqual({ zdr: true });
    expect(routingPreferences({ noTraining: true, zdr: true })).toEqual({ data_collection: "deny", zdr: true });
    expect(routingPreferences({ noTraining: false, zdr: false })).toBeUndefined();
    expect(modelsListUrl(true)).toBe("https://openrouter.ai/api/v1/models?zdr=true");
    expect(modelsListUrl(false)).toBe("https://openrouter.ai/api/v1/models");
    expect(routingPreferences({ noTraining: true, zdr: true }, { quantizations: ["fp8"] })).toEqual({
      data_collection: "deny",
      zdr: true,
      quantizations: ["fp8"]
    });
  });
});

describe("keys", () => {
  it("masks and redacts", () => {
    const key = "sk-or-v1-abcdef0123456789abcdef";
    expect(maskKey(key)).not.toContain("0123456789");
    expect(redactKeys(`Authorization failed for ${key}`)).not.toContain("abcdef0123456789");
    expect(looksLikeKey(key)).toBe(true);
    expect(looksLikeKey("hello")).toBe(false);
  });
});

describe("OpenRouter PKCE", () => {
  it("creates a verifier and an S256 challenge", async () => {
    const a = await createPkce();
    const b = await createPkce();
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(a.verifier));
    const expected = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(a.challenge).toBe(expected);
  });

  it("builds the auth URL with and without a callback", () => {
    const withCb = new URL(buildAuthUrl("abc", "https://app.example/"));
    expect(withCb.origin + withCb.pathname).toBe("https://openrouter.ai/auth");
    expect(withCb.searchParams.get("callback_url")).toBe("https://app.example/");
    expect(withCb.searchParams.get("code_challenge_method")).toBe("S256");
    expect(new URL(buildAuthUrl("abc")).searchParams.has("callback_url")).toBe(false);
  });

  it("exchanges a code for a key and fails cleanly", async () => {
    let body = "";
    const okFetch = (async (_url: string, init: RequestInit) => {
      body = String(init.body);
      return new Response(JSON.stringify({ key: "sk-or-v1-x" }), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await exchangeCode("c", "v", okFetch)).toBe("sk-or-v1-x");
    expect(JSON.parse(body)).toEqual({ code: "c", code_verifier: "v", code_challenge_method: "S256" });
    const bad = (async () => new Response("{}", { status: 400 })) as unknown as typeof fetch;
    await expect(exchangeCode("c", "v", bad)).rejects.toThrow("400");
  });
});

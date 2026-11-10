import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { routingPreferences, SUGGESTED_MODELS } from "./models";

export { OPENROUTER_ORIGIN } from "./origin";
import { OPENROUTER_ORIGIN } from "./origin";

export interface ModelSelection {
  apiKey: string;
  modelId: string;
  /** Send `data_collection: deny`. */
  privacyOnly: boolean;
  /** Send `zdr: true` (zero data retention endpoints only). */
  zdrOnly?: boolean;
  /** Custom fetch (desktop routes calls through the main process). */
  fetch?: typeof fetch;
  /** Let the model search the web through OpenRouter's server tool. */
  webSearch?: boolean;
}

/**
 * OpenRouter's web search server tool. The model decides when to call it; the
 * limits bound cost and context per request.
 */
export const WEB_SEARCH_TOOL = {
  type: "openrouter:web_search",
  parameters: { max_uses: 3, max_results: 5, max_total_results: 15 }
} as const;

/** Adds the web search tool to JSON request bodies; everything else passes through. */
export function withWebSearch(base: typeof fetch): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    if (typeof init?.body === "string") {
      try {
        const body = JSON.parse(init.body) as unknown;
        if (body && typeof body === "object" && !Array.isArray(body)) {
          const record = body as { tools?: unknown };
          const tools = Array.isArray(record.tools) ? record.tools : [];
          const present = tools.some((t) => (t as { type?: unknown } | null)?.type === WEB_SEARCH_TOOL.type);
          if (!present) {
            return base(input, { ...init, body: JSON.stringify({ ...record, tools: [...tools, WEB_SEARCH_TOOL] }) });
          }
        }
      } catch {
        /* not JSON: send it as it is */
      }
    }
    return base(input, init);
  }) as typeof fetch;
}

export function createAssistantModel(selection: ModelSelection): LanguageModel {
  const provider = createOpenRouter({
    apiKey: selection.apiKey,
    compatibility: "strict",
    ...(selection.webSearch
      ? { fetch: withWebSearch(selection.fetch ?? ((input, init) => globalThis.fetch(input, init))) }
      : selection.fetch
        ? { fetch: selection.fetch }
        : {})
  });
  const suggested = SUGGESTED_MODELS.find((m) => m.id === selection.modelId);
  const routing = routingPreferences({ noTraining: selection.privacyOnly, zdr: selection.zdrOnly === true }, suggested);
  return provider(selection.modelId, {
    usage: { include: true },
    ...(routing ? { provider: routing } : {})
  }) as unknown as LanguageModel;
}

export { maskKey, looksLikeKey, redactKeys } from "@mdword/shared";

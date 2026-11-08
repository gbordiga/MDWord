import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { routingPreferences, SUGGESTED_MODELS } from "./models";

export const OPENROUTER_ORIGIN = "https://openrouter.ai";

export interface ModelSelection {
  apiKey: string;
  modelId: string;
  privacyOnly: boolean;
  /** Custom fetch (desktop routes calls through the main process). */
  fetch?: typeof fetch;
}

export function createAssistantModel(selection: ModelSelection): LanguageModel {
  const provider = createOpenRouter({
    apiKey: selection.apiKey,
    compatibility: "strict",
    ...(selection.fetch ? { fetch: selection.fetch } : {})
  });
  const suggested = SUGGESTED_MODELS.find((m) => m.id === selection.modelId);
  const routing = routingPreferences(selection.privacyOnly, suggested);
  return provider(selection.modelId, {
    usage: { include: true },
    ...(routing ? { provider: routing } : {})
  }) as unknown as LanguageModel;
}

export function maskKey(key: string): string {
  if (key.length <= 8) return "\u2022\u2022\u2022\u2022";
  return `${key.slice(0, 6)}\u2026${key.slice(-4)}`;
}

/** Keys look like `sk-or-v1-...`; refuse obvious non-keys before storing. */
export function looksLikeKey(value: string): boolean {
  return /^sk-or-[A-Za-z0-9_-]{16,}$/.test(value.trim());
}

/** Remove anything that looks like a key from text that may be logged or shown. */
export function redactKeys(text: string): string {
  return text.replace(/sk-or-[A-Za-z0-9_-]{8,}/g, "sk-or-\u2026");
}

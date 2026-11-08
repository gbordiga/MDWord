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

export { maskKey, looksLikeKey, redactKeys } from "@mdword/shared";

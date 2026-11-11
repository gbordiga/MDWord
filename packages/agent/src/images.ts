import { routingPreferences, type ProviderPrefs } from "./models";

/** A current OpenRouter image model. The user can change it in settings. */
export const DEFAULT_IMAGE_MODEL_ID = "google/gemini-2.5-flash-image";

export function imageGenerationRequest(options: {
  model: string;
  prompt: string;
  privacyOnly: boolean;
  zdrOnly: boolean;
}): { url: string; body: Record<string, unknown> } {
  const provider: ProviderPrefs | undefined = routingPreferences({
    noTraining: options.privacyOnly,
    zdr: options.zdrOnly
  });
  return {
    url: "https://openrouter.ai/api/v1/chat/completions",
    body: {
      model: options.model,
      messages: [{ role: "user", content: options.prompt }],
      modalities: ["image", "text"],
      ...(provider ? { provider } : {})
    }
  };
}

/** Pull the first generated image out of an OpenRouter chat response. */
export function parseGeneratedImage(json: unknown): { dataUrl: string; costUsd: number | null } | { error: string } {
  const root = json as {
    error?: { message?: unknown };
    usage?: { cost?: unknown };
    choices?: { message?: { images?: unknown; content?: unknown } }[];
  };
  if (root?.error && typeof root.error.message === "string") return { error: root.error.message };
  const message = root?.choices?.[0]?.message;
  const candidates: unknown[] = [];
  if (Array.isArray(message?.images)) candidates.push(...message.images);
  if (Array.isArray(message?.content)) candidates.push(...message.content);
  for (const item of candidates) {
    const record = item as { image_url?: { url?: unknown }; url?: unknown };
    const url = record?.image_url?.url ?? record?.url;
    if (typeof url === "string" && url.startsWith("data:image/")) {
      const cost = root.usage?.cost;
      return { dataUrl: url, costUsd: typeof cost === "number" && Number.isFinite(cost) ? cost : null };
    }
  }
  return { error: "The image model did not return an image." };
}

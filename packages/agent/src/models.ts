import catalog from "./suggested-models.json";

export type Tier = "low" | "balanced" | "quality";

export interface SuggestedModel {
  id: string;
  tier: Tier;
  reasoning: "optional" | "mandatory";
  reason: string;
  /** OpenRouter provider-routing quantization filter, when precision matters. */
  quantizations?: string[];
}

export const SUGGESTED_MODELS: SuggestedModel[] = catalog.models as SuggestedModel[];
export const DEFAULT_MODEL_ID: string = catalog.default;
export const SUGGESTED_LAST_VERIFIED: string = catalog.lastVerified;

/** Estimated cost per turn above which a model no longer fits the tier (USD). */
export const TIER_COST_CAP: Record<Tier, number> = { low: 0.005, balanced: 0.04, quality: Infinity };

export interface ModelInfo {
  id: string;
  name: string;
  contextLength: number;
  /** USD per token. */
  promptPrice: number;
  completionPrice: number;
  supportsTools: boolean;
  expired: boolean;
}

interface RawModel {
  id?: unknown;
  name?: unknown;
  context_length?: unknown;
  pricing?: { prompt?: unknown; completion?: unknown };
  supported_parameters?: unknown;
  expiration_date?: unknown;
}

/** Parse the OpenRouter `/api/v1/models` response. Unknown shapes yield an empty list. */
export function parseModelList(json: unknown, now = Date.now()): ModelInfo[] {
  const data = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  const out: ModelInfo[] = [];
  for (const raw of data as RawModel[]) {
    if (typeof raw?.id !== "string") continue;
    const params = Array.isArray(raw.supported_parameters) ? raw.supported_parameters : [];
    const expires = typeof raw.expiration_date === "string" ? Date.parse(raw.expiration_date) : NaN;
    out.push({
      id: raw.id,
      name: typeof raw.name === "string" ? raw.name : raw.id,
      contextLength: Number(raw.context_length) || 0,
      promptPrice: Number(raw.pricing?.prompt) || 0,
      completionPrice: Number(raw.pricing?.completion) || 0,
      supportsTools: params.includes("tools"),
      expired: Number.isFinite(expires) && expires <= now
    });
  }
  return out;
}

export interface SuggestionCheck {
  usable: SuggestedModel[];
  dropped: { id: string; reason: string }[];
}

/** Keep only suggested ids that still exist, support tools, and have not expired. */
export function checkSuggested(
  suggested: SuggestedModel[],
  live: ModelInfo[]
): SuggestionCheck {
  const byId = new Map(live.map((m) => [m.id, m]));
  const usable: SuggestedModel[] = [];
  const dropped: { id: string; reason: string }[] = [];
  for (const entry of suggested) {
    const info = byId.get(entry.id);
    if (!info) dropped.push({ id: entry.id, reason: "not in the live model list" });
    else if (info.expired) dropped.push({ id: entry.id, reason: "expired" });
    else if (!info.supportsTools) dropped.push({ id: entry.id, reason: "no tool calling" });
    else usable.push(entry);
  }
  return { usable, dropped };
}

export interface Pricing {
  promptPrice: number;
  completionPrice: number;
}

export function costFromUsage(
  usage: { inputTokens: number; outputTokens: number },
  pricing: Pricing | null
): number | null {
  if (!pricing) return null;
  return usage.inputTokens * pricing.promptPrice + usage.outputTokens * pricing.completionPrice;
}

export function formatUsd(amount: number): string {
  if (amount === 0) return "$0.00";
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}

export function formatPerMillion(pricePerToken: number): string {
  return `$${(pricePerToken * 1_000_000).toFixed(2)}`;
}

export interface ProviderPrefs {
  data_collection?: "deny" | "allow";
  zdr?: boolean;
  quantizations?: string[];
}

/** OpenRouter provider-routing preferences for the privacy toggle and suggested-model precision. */
export function routingPreferences(
  privacyOnly: boolean,
  model?: Pick<SuggestedModel, "quantizations">
): ProviderPrefs | undefined {
  const prefs: ProviderPrefs = {};
  if (privacyOnly) prefs.data_collection = "deny";
  if (model?.quantizations?.length) prefs.quantizations = model.quantizations;
  return Object.keys(prefs).length > 0 ? prefs : undefined;
}

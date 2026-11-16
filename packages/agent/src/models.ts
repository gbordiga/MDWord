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
  /** Artificial Analysis intelligence index reported by OpenRouter (about 0 to 65), when known. */
  intelligence: number | null;
  /** True when `intelligence` is estimated from the coding or agentic index, or from the base model. */
  intelligenceEstimated: boolean;
  codingIndex: number | null;
  agenticIndex: number | null;
  /** Release time as a Unix timestamp in seconds; 0 when unknown. */
  created: number;
  /** What the model produces: `text`, `image`, or both. */
  outputModalities: string[];
  /** USD per generated picture, when OpenRouter lists a flat price; 0 otherwise. */
  pricePerImage: number;
  /** USD per generated image token; 0 when unknown. */
  imageTokenPrice: number;
}

interface RawModel {
  id?: unknown;
  name?: unknown;
  context_length?: unknown;
  pricing?: { prompt?: unknown; completion?: unknown; image?: unknown; image_output?: unknown };
  architecture?: { output_modalities?: unknown } | null;
  supported_parameters?: unknown;
  expiration_date?: unknown;
  created?: unknown;
  benchmarks?: {
    artificial_analysis?: { intelligence_index?: unknown; coding_index?: unknown; agentic_index?: unknown };
  } | null;
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
    const aa = raw.benchmarks?.artificial_analysis;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    out.push({
      id: raw.id,
      name: typeof raw.name === "string" ? raw.name : raw.id,
      contextLength: Number(raw.context_length) || 0,
      promptPrice: Number(raw.pricing?.prompt) || 0,
      completionPrice: Number(raw.pricing?.completion) || 0,
      supportsTools: params.includes("tools"),
      expired: Number.isFinite(expires) && expires <= now,
      intelligence: num(aa?.intelligence_index),
      intelligenceEstimated: false,
      codingIndex: num(aa?.coding_index),
      agenticIndex: num(aa?.agentic_index),
      created: num(raw.created) ?? 0,
      outputModalities: Array.isArray(raw.architecture?.output_modalities)
        ? (raw.architecture.output_modalities as unknown[]).filter((m): m is string => typeof m === "string")
        : [],
      pricePerImage: Number(raw.pricing?.image) || 0,
      imageTokenPrice: Number(raw.pricing?.image_output) || 0
    });
  }
  estimateIntelligence(out);
  return out;
}

/** The id without a variant suffix such as `:free` or `:batch`. Plain string search: no regex backtracking. */
function withoutVariant(id: string): string {
  const colon = id.indexOf(":");
  return colon === -1 ? id : id.slice(0, colon);
}

/** The base model of a `:variant` id, or the id itself. */
function baseId(id: string): string {
  const colon = id.lastIndexOf(":");
  return colon !== -1 && /^[a-z]+$/.test(id.slice(colon + 1)) ? id.slice(0, colon) : id;
}

/**
 * The model line an id belongs to, with versions, dates, and variant suffixes
 * removed: `anthropic/claude-sonnet-4.6` and `anthropic/claude-sonnet-5.5`
 * are both `anthropic/claude-sonnet`.
 */
export function modelFamily(id: string): string {
  const [vendor, ...rest] = id.split("/");
  const slug = withoutVariant(rest.join("/"))
    .replace(/-\d{4,8}$/, "")
    .replace(/(^|-)v?\d+(\.\d+)*(?=-|$)/g, "$1")
    .replace(/(\D)\d+(\.\d+)*(?=-|$)/g, "$1")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${vendor}/${slug}`;
}

/**
 * Keep only the newest model of each line, drop `:batch` variants (offline
 * pricing) and `~…-latest` aliases (they duplicate a real model), and always keep the ids in `keep` (suggested and selected models).
 */
export function latestModels(models: ModelInfo[], keep: ReadonlySet<string> = new Set()): ModelInfo[] {
  const newest = new Map<string, ModelInfo>();
  for (const m of models) {
    if (m.id.endsWith(":batch") || m.id.startsWith("~")) continue;
    const family = modelFamily(m.id);
    const best = newest.get(family);
    const better =
      !best || m.created > best.created || (m.created === best.created && !m.id.includes(":") && best.id.includes(":"));
    if (better) newest.set(family, m);
  }
  const latest = new Set([...newest.values()].map((m) => m.id));
  return models.filter((m) => latest.has(m.id) || keep.has(m.id));
}

const MIN_FIT_PAIRS = 8;

function fitLine(pairs: [number, number][]): ((x: number) => number) | null {
  if (pairs.length < MIN_FIT_PAIRS) return null;
  const n = pairs.length;
  const mx = pairs.reduce((s, p) => s + p[0], 0) / n;
  const my = pairs.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
  }
  if (sxx === 0) return null;
  const a = sxy / sxx;
  return (x) => Math.min(70, Math.max(0, my + a * (x - mx)));
}

/**
 * OpenRouter reports the intelligence index for only some models. Where it is
 * missing, estimate it from the agentic index (else the coding index) with a
 * line fitted on the models that have both, then let `:batch`-style variants
 * take the value of their base model. Estimates are flagged.
 */
function estimateIntelligence(models: ModelInfo[]): void {
  const pairs = (pick: (m: ModelInfo) => number | null) =>
    models.flatMap((m) => {
      const x = pick(m);
      return m.intelligence != null && x != null ? ([[x, m.intelligence]] as [number, number][]) : [];
    });
  const fromAgentic = fitLine(pairs((m) => m.agenticIndex));
  const fromCoding = fitLine(pairs((m) => m.codingIndex));
  const real = new Map(models.filter((m) => m.intelligence != null).map((m) => [m.id, m.intelligence!]));
  for (const m of models) {
    if (m.intelligence != null) continue;
    const value =
      fromAgentic && m.agenticIndex != null
        ? fromAgentic(m.agenticIndex)
        : fromCoding && m.codingIndex != null
          ? fromCoding(m.codingIndex)
          : null;
    if (value != null) {
      m.intelligence = Math.round(value * 10) / 10;
      m.intelligenceEstimated = true;
    }
  }
  const byId = new Map(models.map((m) => [m.id, m]));
  for (const m of models) {
    if (m.intelligence != null) continue;
    const base = byId.get(baseId(m.id));
    if (base && base !== m && base.intelligence != null) {
      m.intelligence = base.intelligence;
      m.intelligenceEstimated = base.intelligenceEstimated || !real.has(base.id);
    }
  }
}

/** Cost of a typical turn: 18K input tokens and 1.5K output tokens (USD). */
export function typicalTurnCost(info: Pick<ModelInfo, "promptPrice" | "completionPrice">): number {
  return 18_000 * info.promptPrice + 1_500 * info.completionPrice;
}

/** 1 (cheapest) to 5 (most expensive), from the cost of a typical turn. */
export function priceLevel(info: Pick<ModelInfo, "promptPrice" | "completionPrice">): 1 | 2 | 3 | 4 | 5 {
  const cost = typicalTurnCost(info);
  return cost < 0.002 ? 1 : cost < 0.01 ? 2 : cost < 0.04 ? 3 : cost < 0.15 ? 4 : 5;
}

/** 1 to 5 from the intelligence index, or null when OpenRouter reports none. */
export function intelligenceLevel(info: Pick<ModelInfo, "intelligence">): 1 | 2 | 3 | 4 | 5 | null {
  const v = info.intelligence;
  if (v == null) return null;
  return v < 15 ? 1 : v < 28 ? 2 : v < 40 ? 3 : v < 50 ? 4 : 5;
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

/**
 * How much the model reasons before it answers. `default` sends nothing and
 * leaves the choice to the model; `none` turns reasoning off where the model allows it.
 */
export type ReasoningEffort = "default" | "none" | "low" | "medium" | "high";
export const REASONING_EFFORTS: readonly ReasoningEffort[] = ["default", "none", "low", "medium", "high"];

export function parseReasoningEffort(value: unknown): ReasoningEffort {
  return REASONING_EFFORTS.includes(value as ReasoningEffort) ? (value as ReasoningEffort) : "default";
}

/** Efforts the picker offers for a model. Mandatory reasoning cannot be switched off. */
export function reasoningChoices(model?: Pick<SuggestedModel, "reasoning">): ReasoningEffort[] {
  return model?.reasoning === "mandatory"
    ? REASONING_EFFORTS.filter((effort) => effort !== "none")
    : [...REASONING_EFFORTS];
}

/** The effort to send. A choice the model cannot take falls back to `default`. */
export function effectiveReasoning(
  effort: ReasoningEffort,
  model?: Pick<SuggestedModel, "reasoning">
): ReasoningEffort {
  return reasoningChoices(model).includes(effort) ? effort : "default";
}

const MODELS_URL = "https://openrouter.ai/api/v1/models";

/**
 * Public model list. With zero data retention on, `zdr=true` keeps only models
 * that have a ZDR endpoint. `data_collection: deny` has no list query; it is
 * sent on each chat request.
 */
export function modelsListUrl(zdrOnly: boolean): string {
  return zdrOnly ? `${MODELS_URL}?zdr=true` : MODELS_URL;
}

/**
 * Models that generate pictures. The default list holds only models that answer
 * in text, so pictures need their own query. `zdr=true` applies here too.
 */
export function imageModelsListUrl(zdrOnly: boolean): string {
  return `${MODELS_URL}?output_modalities=image${zdrOnly ? "&zdr=true" : ""}`;
}

/** Newest first, and only models that really output pictures. */
export function imageModels(models: ModelInfo[]): ModelInfo[] {
  return models
    .filter((m) => m.outputModalities.includes("image") && !m.expired)
    .sort((a, b) => b.created - a.created || a.name.localeCompare(b.name));
}

/** A model that returns pictures only, and so must not be asked for text. */
export function isImageOnly(model: Pick<ModelInfo, "outputModalities"> | undefined): boolean {
  return model != null && model.outputModalities.includes("image") && !model.outputModalities.includes("text");
}

/** About how many image tokens one picture takes, when a model is priced per token. */
const TYPICAL_IMAGE_TOKENS = 1300;

/** Cost of one picture in USD, or null when OpenRouter lists no image price. */
export function typicalImageCost(info: Pick<ModelInfo, "pricePerImage" | "imageTokenPrice">): number | null {
  if (info.pricePerImage > 0) return info.pricePerImage;
  if (info.imageTokenPrice > 0) return info.imageTokenPrice * TYPICAL_IMAGE_TOKENS;
  return null;
}

/** 1 (cheapest) to 5 (most expensive) from the cost of one picture, or null when unknown. */
export function imagePriceLevel(
  info: Pick<ModelInfo, "pricePerImage" | "imageTokenPrice">
): 1 | 2 | 3 | 4 | 5 | null {
  const cost = typicalImageCost(info);
  if (cost == null) return null;
  return cost < 0.01 ? 1 : cost < 0.03 ? 2 : cost < 0.06 ? 3 : cost < 0.12 ? 4 : 5;
}

/** Short price line for a picture model: per picture when known, else per million image tokens. */
export function imagePriceLabel(info: Pick<ModelInfo, "pricePerImage" | "imageTokenPrice">): string {
  if (info.pricePerImage > 0) return `$${Number(info.pricePerImage.toPrecision(2))} / image`;
  if (info.imageTokenPrice > 0) return `$${(info.imageTokenPrice * 1_000_000).toFixed(2)} / 1M image tokens`;
  return "";
}

/**
 * OpenRouter provider-routing preferences. `data_collection: deny` excludes
 * providers that store or train on prompts; `zdr` is stricter (no retention
 * after processing). They are separate settings.
 */
export function routingPreferences(
  privacy: { noTraining: boolean; zdr: boolean },
  model?: Pick<SuggestedModel, "quantizations">
): ProviderPrefs | undefined {
  const prefs: ProviderPrefs = {};
  if (privacy.noTraining) prefs.data_collection = "deny";
  if (privacy.zdr) prefs.zdr = true;
  if (model?.quantizations?.length) prefs.quantizations = model.quantizations;
  return Object.keys(prefs).length > 0 ? prefs : undefined;
}

import { streamText, type LanguageModel, type ModelMessage } from "ai";
import { costFromUsage, type Pricing } from "./models";
import { redactKeys } from "./openrouter";
import { buildSystemPrompt } from "./prompt";
import type { InstructionFile } from "./instructions";
import { t, type MessageKey } from "./messages.en";
import { createTools, type ToolContext } from "./tools";
import {
  defaultLimits,
  type AssistantEnv,
  type StopReason,
  type TurnEvent,
  type TurnLimits
} from "./types";

export interface TurnInput {
  model: LanguageModel;
  history: ModelMessage[];
  userText: string;
  /** Per-turn context block (open file, selection, outline). */
  context: string;
  env: AssistantEnv;
  limits?: Partial<TurnLimits>;
  pricing?: Pricing | null;
  /** Spend before this turn, for the session cap. */
  spentBeforeUsd?: number;
  /** `null` or undefined disables the cap. */
  spendCapUsd?: number | null;
  /** The user allowed web search: adds instructions to the system prompt. */
  webSearch?: boolean;
  /** AGENTS.md-style files found in the workspace, nearest first. */
  instructions?: InstructionFile[];
  signal?: AbortSignal;
  onEvent: (event: TurnEvent) => void;
}

export interface TurnResult {
  /** Conversation to pass to the next turn (user text without the context block). */
  history: ModelMessage[];
  stop: StopReason;
  costUsd: number;
}

export const STOP_MESSAGE: Record<StopReason, MessageKey> = {
  done: "stop.done",
  "max-steps": "stop.maxSteps",
  "tool-budget": "stop.toolBudget",
  "spend-cap": "stop.spendCap",
  failures: "stop.failures",
  aborted: "stop.aborted",
  error: "error.unknown"
};

/** Map a provider or network failure to a catalog key. Never exposes request headers. */
export function classifyError(error: unknown): MessageKey {
  const e = error as { statusCode?: number; message?: string; name?: string } | null;
  const status = e?.statusCode;
  const message = String(e?.message ?? "");
  if (/model_stalled/.test(message)) return "error.stalled";
  if (/data policy|data_collection|no endpoints found/i.test(message)) return "error.privacy";
  if (status === 401 || status === 403) return "error.auth";
  if (status === 402) return "error.credits";
  if (status === 429) return "error.rateLimit";
  if (status === 404 || status === 400) return "error.model";
  if (e?.name === "TypeError" || /failed to fetch|fetch failed|network/i.test(message)) {
    return "error.network";
  }
  return "error.unknown";
}

function errorDetail(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return redactKeys(raw).slice(0, 300);
}

function openRouterCost(metadata: unknown): number | null {
  const cost = (metadata as { openrouter?: { usage?: { cost?: unknown } } } | undefined)?.openrouter
    ?.usage?.cost;
  return typeof cost === "number" && Number.isFinite(cost) ? cost : null;
}

export async function runAssistantTurn(input: TurnInput): Promise<TurnResult> {
  const limits = { ...defaultLimits, ...input.limits };
  const ctx: ToolContext = {
    env: input.env,
    signal: input.signal,
    maxToolChars: limits.maxToolChars,
    toolChars: 0,
    stopReason: null,
    // Project instruction files are text the user did not write in this chat. Web
    // search sources arrive on the stream and can lag a same-step command, so a turn
    // that may search is tainted from the start.
    tainted: input.webSearch === true || (input.instructions?.length ?? 0) > 0
  };
  const tools = createTools(ctx);
  const userMessage: ModelMessage = { role: "user", content: input.userText };
  const sent: ModelMessage = {
    role: "user",
    content: input.context ? `${input.context}\n\n${input.userText}` : input.userText
  };

  let turnCost = 0;
  let failureTool = "";
  let failureCount = 0;
  let lastFinish = "";
  let streamError: unknown = null;
  const names = new Map<string, string>();

  const noteFailure = (tool: string) => {
    failureCount = failureTool === tool ? failureCount + 1 : 1;
    failureTool = tool;
    if (failureCount >= limits.maxConsecutiveFailures && ctx.stopReason == null) {
      ctx.stopReason = "failures";
    }
  };
  const noteSuccess = () => {
    failureTool = "";
    failureCount = 0;
  };

  // Stall watchdog: abort when the model sends nothing for a long time. It is
  // paused while a tool runs (an edit can wait for the user for as long as needed).
  const stall = new AbortController();
  const onOuterAbort = () => stall.abort();
  if (input.signal?.aborted) stall.abort();
  input.signal?.addEventListener("abort", onOuterAbort, { once: true });
  let stalled = false;
  let inFlight = 0;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  const disarm = () => {
    if (watchdog) clearTimeout(watchdog);
    watchdog = null;
  };
  const arm = () => {
    disarm();
    if (inFlight > 0 || !limits.stallMs) return;
    watchdog = setTimeout(() => {
      stalled = true;
      stall.abort();
    }, limits.stallMs);
  };
  arm();

  const result = streamText({
    model: input.model,
    system: buildSystemPrompt({
      webSearch: input.webSearch,
      shell: input.env.runCommand != null,
      instructions: input.instructions
    }),
    messages: [...input.history, sent],
    tools,
    abortSignal: stall.signal,
    stopWhen: [
      ({ steps }) => {
        if (steps.length >= limits.maxSteps && ctx.stopReason == null) ctx.stopReason = "max-steps";
        return ctx.stopReason != null;
      }
    ]
  });

  let pendingSources: { url: string; title?: string }[] = [];
  try {
    for await (const part of result.fullStream) {
      if (part.type === "tool-call") inFlight += 1;
      else if (part.type === "tool-result" || part.type === "tool-error") inFlight = Math.max(0, inFlight - 1);
      arm();
      // Web search runs inside the model's turn and has no tool call of its own:
      // the pages it used arrive as source parts, shown once as a step.
      if (part.type === "source") {
        if (part.sourceType === "url") pendingSources.push({ url: part.url, title: part.title });
        ctx.tainted = true;
        continue;
      }
      if (pendingSources.length > 0) {
        input.onEvent({ type: "sources", sources: pendingSources });
        pendingSources = [];
      }
      switch (part.type) {
        case "text-delta":
          input.onEvent({ type: "text", text: part.text });
          break;
        case "tool-call":
          names.set(part.toolCallId, part.toolName);
          input.onEvent({
            type: "tool-start",
            id: part.toolCallId,
            name: part.toolName,
            input: part.input
          });
          break;
        case "tool-result": {
          const out = part.output as { ok?: boolean; error?: string } | undefined;
          const ok = out?.ok !== false;
          input.onEvent({
            type: "tool-end",
            id: part.toolCallId,
            name: part.toolName,
            ok,
            detail: ok ? undefined : out?.error
          });
          if (ok) noteSuccess();
          else noteFailure(part.toolName);
          break;
        }
        case "tool-error":
          input.onEvent({
            type: "tool-end",
            id: part.toolCallId,
            name: part.toolName,
            ok: false,
            detail: errorDetail(part.error)
          });
          noteFailure(part.toolName);
          break;
        case "finish-step": {
          lastFinish = String(part.finishReason);
          const inputTokens = Number(part.usage.inputTokens ?? 0);
          const outputTokens = Number(part.usage.outputTokens ?? 0);
          const cost =
            openRouterCost(part.providerMetadata) ??
            costFromUsage({ inputTokens, outputTokens }, input.pricing ?? null);
          if (cost != null) turnCost += cost;
          input.onEvent({ type: "usage", inputTokens, outputTokens, costUsd: cost });
          const cap = input.spendCapUsd;
          if (cap != null && (input.spentBeforeUsd ?? 0) + turnCost >= cap && ctx.stopReason == null) {
            ctx.stopReason = "spend-cap";
          }
          break;
        }
        case "error":
          streamError = part.error;
          break;
        default:
          break;
      }
    }
  } catch (error) {
    streamError = error;
  }
  disarm();
  input.signal?.removeEventListener("abort", onOuterAbort);
  if (stalled) streamError = new Error("model_stalled");

  let stop: StopReason;
  if (input.signal?.aborted && !stalled) stop = "aborted";
  else if (streamError != null) stop = "error";
  else if (ctx.stopReason != null && lastFinish === "tool-calls") stop = ctx.stopReason;
  else stop = "done";

  let history: ModelMessage[] = [...input.history, userMessage];
  if (stop !== "aborted" && stop !== "error") {
    try {
      const generated = await result.responseMessages;
      history = [...input.history, userMessage, ...(generated as ModelMessage[])];
    } catch {
      /* keep the user message only */
    }
  }

  if (stop === "error") {
    input.onEvent({ type: "stop", reason: stop, message: t(classifyError(streamError)) });
  } else if (stop !== "done") {
    input.onEvent({ type: "stop", reason: stop, message: t(STOP_MESSAGE[stop]) });
  } else {
    input.onEvent({ type: "stop", reason: stop });
  }
  return { history, stop, costUsd: turnCost };
}

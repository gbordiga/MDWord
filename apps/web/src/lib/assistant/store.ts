"use client";

import { create } from "zustand";
import {
  checkSuggested,
  createAssistantModel,
  createPkce,
  buildAuthUrl,
  exchangeCode,
  DEFAULT_MODEL_ID,
  looksLikeKey,
  parseModelList,
  runAssistantTurn,
  SUGGESTED_MODELS,
  t,
  type EditDecision,
  type EditProposal,
  type ModelInfo,
  type ModelMessage,
  type SuggestedModel,
  type TurnEvent
} from "@mdword/agent";
import type { AssistantKeyStatus } from "@mdword/shared";
import { getHost } from "../host";
import { buildTurnContext } from "./context";
import { applyProposal, createAssistantEnv } from "./env";
import { historyFromThread, parseThread, serializeThread, toolLabel, type ThreadItem } from "./thread";
import { useApp } from "../store";

const SETTINGS_KEY = "mdword.assistant.settings";
export const VERIFIER_KEY = "mdword.assistant.pkceVerifier";
const MODELS_URL = "https://openrouter.ai/api/v1/models";
const DEFAULT_CAP_USD = 3;

export interface AssistantSettings {
  modelId: string;
  /** `null` turns the session cap off. */
  spendCapUsd: number | null;
  privacyOnly: boolean;
  noticeAccepted: boolean;
}

const defaultSettings: AssistantSettings = {
  modelId: DEFAULT_MODEL_ID,
  spendCapUsd: DEFAULT_CAP_USD,
  privacyOnly: true,
  noticeAccepted: false
};

function loadSettings(): AssistantSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<AssistantSettings>;
    return {
      modelId: typeof parsed.modelId === "string" && parsed.modelId ? parsed.modelId : defaultSettings.modelId,
      spendCapUsd:
        parsed.spendCapUsd === null
          ? null
          : typeof parsed.spendCapUsd === "number" && parsed.spendCapUsd > 0
            ? parsed.spendCapUsd
            : defaultSettings.spendCapUsd,
      privacyOnly: parsed.privacyOnly !== false,
      noticeAccepted: parsed.noticeAccepted === true
    };
  } catch {
    return defaultSettings;
  }
}

export type SaveKeyResult = "ok" | "invalid" | "storage";
export type SignInState = "idle" | "waiting" | "failed" | "cancelled";

export interface AssistantState {
  settings: AssistantSettings;
  key: AssistantKeyStatus | null;
  view: "chat" | "settings";
  thread: ThreadItem[];
  running: boolean;
  sessionCostUsd: number;
  costUnknown: boolean;
  models: ModelInfo[] | null;
  modelsFailed: boolean;
  usableSuggested: SuggestedModel[];
  signIn: SignInState;
  workspaceKey: string | null;
  init: () => Promise<void>;
  setView: (view: "chat" | "settings") => void;
  updateSettings: (patch: Partial<AssistantSettings>) => void;
  refreshKey: () => Promise<void>;
  saveKey: (key: string) => Promise<SaveKeyResult>;
  clearKey: () => Promise<void>;
  startSignIn: () => Promise<void>;
  cancelSignIn: () => Promise<void>;
  completeWebSignIn: (code: string) => Promise<void>;
  loadModels: () => Promise<void>;
  loadWorkspaceHistory: (workspaceKey: string) => Promise<void>;
  newChat: () => void;
  clearHistory: () => Promise<void>;
  send: (text: string) => Promise<void>;
  stop: () => void;
  resolveEdit: (id: string, choice: "apply" | "discard") => Promise<void>;
}

let history: ModelMessage[] = [];
let abort: AbortController | null = null;
let seq = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const pending = new Map<string, { proposal: EditProposal; resolve: (d: EditDecision) => void }>();

function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

function assistantHost() {
  return getHost().assistant ?? null;
}

export function assistantSupported(): boolean {
  return assistantHost() != null;
}

export const useAssistant = create<AssistantState>((set, get) => {
  const mutateThread = (fn: (thread: ThreadItem[]) => ThreadItem[]) => {
    set({ thread: fn(get().thread) });
    scheduleSave();
  };

  const patchItem = (id: string, patch: Partial<ThreadItem>) =>
    mutateThread((thread) => thread.map((i) => (i.id === id ? ({ ...i, ...patch } as ThreadItem) : i)));

  const scheduleSave = () => {
    const key = get().workspaceKey;
    const host = assistantHost();
    if (!key || !host) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void host.history.save(key, serializeThread(get().thread)).catch(() => undefined);
    }, 400);
  };

  const propose = (proposal: EditProposal, signal: AbortSignal | undefined) =>
    new Promise<EditDecision>((resolve) => {
      const id = proposal.id;
      mutateThread((thread) => [
        ...thread,
        {
          kind: "edit",
          id,
          path: proposal.path,
          edits: proposal.edits.map((e) => ({ line: e.line, oldText: e.oldText, newText: e.newText })),
          status: "pending"
        }
      ]);
      pending.set(id, { proposal, resolve });
      signal?.addEventListener(
        "abort",
        () => {
          if (!pending.delete(id)) return;
          patchItem(id, { status: "discarded" });
          resolve({ status: "rejected" });
        },
        { once: true }
      );
    });

  const onEvent = (event: TurnEvent) => {
    switch (event.type) {
      case "text": {
        mutateThread((thread) => {
          const last = thread[thread.length - 1];
          if (last?.kind === "assistant") {
            return [...thread.slice(0, -1), { ...last, text: last.text + event.text }];
          }
          return [...thread, { kind: "assistant", id: nextId("a"), text: event.text }];
        });
        break;
      }
      case "tool-start":
        mutateThread((thread) => [
          ...thread,
          {
            kind: "tool",
            id: event.id,
            name: event.name,
            label: toolLabel(event.name, event.input),
            status: "running"
          }
        ]);
        break;
      case "tool-end":
        patchItem(event.id, { status: event.ok ? "ok" : "error", detail: event.detail });
        break;
      case "usage":
        if (event.costUsd == null) set({ costUnknown: true });
        else set({ sessionCostUsd: get().sessionCostUsd + event.costUsd });
        break;
      case "stop":
        if (event.message) {
          mutateThread((thread) => [...thread, { kind: "notice", id: nextId("n"), text: event.message! }]);
        }
        break;
    }
  };

  return {
    settings: defaultSettings,
    key: null,
    view: "chat",
    thread: [],
    running: false,
    sessionCostUsd: 0,
    costUnknown: false,
    models: null,
    modelsFailed: false,
    usableSuggested: SUGGESTED_MODELS,
    signIn: "idle",
    workspaceKey: null,

    init: async () => {
      set({ settings: loadSettings() });
      await get().refreshKey();
    },
    setView: (view) => set({ view }),
    updateSettings: (patch) => {
      const settings = { ...get().settings, ...patch };
      set({ settings });
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch {
        /* settings are best effort */
      }
    },
    refreshKey: async () => {
      const host = assistantHost();
      if (!host) return set({ key: { hasKey: false, masked: null } });
      try {
        set({ key: await host.keyStatus() });
      } catch {
        set({ key: { hasKey: false, masked: null } });
      }
    },
    saveKey: async (value) => {
      const host = assistantHost();
      const key = value.trim();
      if (!host || !looksLikeKey(key)) return "invalid";
      try {
        await host.saveKey(key);
      } catch (error) {
        return /secure-storage-unavailable/.test(String((error as Error)?.message)) ? "storage" : "invalid";
      }
      await get().refreshKey();
      void get().loadModels();
      return "ok";
    },
    clearKey: async () => {
      await assistantHost()?.clearKey();
      await get().refreshKey();
    },
    startSignIn: async () => {
      const host = assistantHost();
      if (!host) return;
      set({ signIn: "waiting" });
      try {
        if (host.signIn) {
          const result = await host.signIn();
          set({ signIn: result.ok ? "idle" : result.cancelled ? "cancelled" : "failed" });
          if (result.ok) {
            await get().refreshKey();
            void get().loadModels();
          }
          return;
        }
        const { verifier, challenge } = await createPkce();
        sessionStorage.setItem(VERIFIER_KEY, verifier);
        const callback = `${window.location.origin}${window.location.pathname}`;
        window.location.assign(buildAuthUrl(challenge, callback));
      } catch {
        set({ signIn: "failed" });
      }
    },
    cancelSignIn: async () => {
      await assistantHost()?.cancelSignIn?.();
      set({ signIn: "idle" });
    },
    completeWebSignIn: async (code) => {
      const host = assistantHost();
      const verifier = sessionStorage.getItem(VERIFIER_KEY);
      if (!host || !verifier) return;
      sessionStorage.removeItem(VERIFIER_KEY);
      set({ signIn: "waiting" });
      try {
        const key = await exchangeCode(code, verifier);
        await host.saveKey(key);
        set({ signIn: "idle" });
        await get().refreshKey();
        void get().loadModels();
      } catch {
        set({ signIn: "failed" });
      }
    },
    loadModels: async () => {
      const host = assistantHost();
      if (!host) return;
      try {
        const response = await host.fetch(MODELS_URL);
        if (!response.ok) throw new Error(String(response.status));
        const models = parseModelList(await response.json());
        if (models.length === 0) throw new Error("empty");
        set({
          models,
          modelsFailed: false,
          usableSuggested: checkSuggested(SUGGESTED_MODELS, models).usable
        });
      } catch {
        set({ modelsFailed: true, usableSuggested: SUGGESTED_MODELS });
      }
    },
    loadWorkspaceHistory: async (workspaceKey) => {
      const host = assistantHost();
      if (get().workspaceKey === workspaceKey) return;
      get().stop();
      set({ workspaceKey, thread: [], sessionCostUsd: 0, costUnknown: false });
      history = [];
      if (!host) return;
      try {
        const thread = parseThread(await host.history.load(workspaceKey));
        if (get().workspaceKey !== workspaceKey) return;
        set({ thread });
        history = historyFromThread(thread);
      } catch {
        /* start empty */
      }
    },
    newChat: () => {
      get().stop();
      history = [];
      set({ thread: [], sessionCostUsd: 0, costUnknown: false });
      scheduleSave();
    },
    clearHistory: async () => {
      get().stop();
      history = [];
      set({ thread: [], sessionCostUsd: 0, costUnknown: false });
      const key = get().workspaceKey;
      if (key) await assistantHost()?.history.clear(key);
    },
    stop: () => abort?.abort(),
    send: async (text) => {
      const host = assistantHost();
      const trimmed = text.trim();
      const state = get();
      if (!host || !trimmed || state.running || !state.key?.hasKey || !state.settings.noticeAccepted) return;
      const controller = new AbortController();
      abort = controller;
      set({ running: true });
      mutateThread((thread) => [...thread, { kind: "user", id: nextId("u"), text: trimmed }]);
      useApp.getState().flushPendingEdits();
      const info = state.models?.find((m) => m.id === state.settings.modelId) ?? null;
      const model = createAssistantModel({
        apiKey: "host-managed",
        modelId: state.settings.modelId,
        privacyOnly: state.settings.privacyOnly,
        fetch: (input, init) =>
          host.fetch(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, init)
      });
      try {
        const result = await runAssistantTurn({
          model,
          history,
          userText: trimmed,
          context: buildTurnContext(),
          env: createAssistantEnv({ propose }),
          pricing: info,
          spentBeforeUsd: get().sessionCostUsd,
          spendCapUsd: state.settings.spendCapUsd,
          signal: controller.signal,
          onEvent
        });
        history = result.history;
      } finally {
        for (const [id, entry] of pending) {
          pending.delete(id);
          patchItem(id, { status: "discarded" });
          entry.resolve({ status: "rejected" });
        }
        if (abort === controller) abort = null;
        set({ running: false });
      }
    },
    resolveEdit: async (id, choice) => {
      const entry = pending.get(id);
      if (!entry) return;
      pending.delete(id);
      if (choice === "discard") {
        patchItem(id, { status: "discarded" });
        entry.resolve({ status: "rejected" });
        return;
      }
      const decision = await applyProposal(entry.proposal);
      patchItem(id, { status: decision.status === "applied" ? "applied" : "stale" });
      entry.resolve(decision);
    }
  };
});

export { t };

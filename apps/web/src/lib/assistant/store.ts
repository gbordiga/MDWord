"use client";

import { create } from "zustand";
import {
  checkSuggested,
  createPkce,
  buildAuthUrl,
  exchangeCode,
  DEFAULT_IMAGE_MODEL_ID,
  DEFAULT_MODEL_ID,
  imageGenerationRequest,
  parseGeneratedImage,
  modelsListUrl,
  parseModelList,
  SUGGESTED_MODELS,
  t,
  checkCommand,
  type CommandOutcome,
  type CommandRequest,
  type DeleteDecision,
  type EditDecision,
  type EditProposal,
  type ModelInfo,
  type ModelMessage,
  type SuggestedModel,
  type TurnEvent
} from "@mdword/agent";
import {
  looksLikeKey,
  redactKeys,
  type AssistantKeyStatus,
  type ShellAvailability,
  type ShellMode
} from "@mdword/shared";
import { relativeWorkspacePath } from "@mdword/workspace";
import { getHost } from "../host";
import { attachedFilesContext, buildTurnContext, mentionFiles } from "./context";
import { mentionedPaths } from "./mentions";
import { embedImageSrc } from "@mdword/editor";
import { imageReference } from "@mdword/shared";
import { applyProposal, createAssistantEnv, deleteConfirmedFile, inspectDelete, loadInstructionFiles } from "./env";
import {
  conversationKey,
  indexKey,
  MAX_CONVERSATIONS,
  parseIndex,
  serializeIndex,
  titleFromThread,
  type ConversationMeta
} from "./conversations";
import { historyFromThread, parseThread, serializeThread, toolLabel, type ThreadItem } from "./thread";
import { useApp } from "../store";

const SETTINGS_KEY = "mdword.assistant.settings";
export const VERIFIER_KEY = "mdword.assistant.pkceVerifier";
const DEFAULT_CAP_USD = 3;

export interface AssistantSettings {
  modelId: string;
  /** OpenRouter model used only for generated pictures. */
  imageModelId: string;
  /** `null` turns the session cap off. */
  spendCapUsd: number | null;
  privacyOnly: boolean;
  /** Only route to zero-data-retention endpoints; the model list is filtered to match. */
  zdrOnly: boolean;
  /** The model may search the web (OpenRouter server tool). On until the user turns it off. */
  webSearch: boolean;
  /** `manual` waits for Apply. `auto` writes the edit as soon as the model proposes it. */
  editApproval: "manual" | "auto";
  noticeAccepted: boolean;
  /** Command mode per workspace. Missing means off. User level: a project cannot turn it on. */
  shell: Record<string, ShellMode>;
}

const SHELL_MODES: readonly ShellMode[] = ["off", "manual", "ai", "always"];

const defaultSettings: AssistantSettings = {
  modelId: DEFAULT_MODEL_ID,
  imageModelId: DEFAULT_IMAGE_MODEL_ID,
  spendCapUsd: DEFAULT_CAP_USD,
  privacyOnly: true,
  zdrOnly: true,
  webSearch: true,
  editApproval: "manual",
  noticeAccepted: false,
  shell: {}
};

function parseShellModes(value: unknown): Record<string, ShellMode> {
  const out: Record<string, ShellMode> = {};
  if (!value || typeof value !== "object") return out;
  for (const [key, mode] of Object.entries(value as Record<string, unknown>)) {
    if (SHELL_MODES.includes(mode as ShellMode) && mode !== "off") out[key] = mode as ShellMode;
  }
  return out;
}

/** The command mode of the open workspace. Always `off` where the host cannot run commands. */
export function shellModeOf(state: Pick<AssistantState, "settings" | "workspaceKey">): ShellMode {
  if (!getHost().assistant?.shell || !state.workspaceKey) return "off";
  return state.settings.shell[state.workspaceKey] ?? "off";
}

function loadSettings(): AssistantSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<AssistantSettings>;
    return {
      modelId: typeof parsed.modelId === "string" && parsed.modelId ? parsed.modelId : defaultSettings.modelId,
      imageModelId:
        typeof parsed.imageModelId === "string" && parsed.imageModelId ? parsed.imageModelId : defaultSettings.imageModelId,
      spendCapUsd:
        parsed.spendCapUsd === null
          ? null
          : typeof parsed.spendCapUsd === "number" && parsed.spendCapUsd > 0
            ? parsed.spendCapUsd
            : defaultSettings.spendCapUsd,
      privacyOnly: parsed.privacyOnly !== false,
      zdrOnly: parsed.zdrOnly !== false,
      webSearch: parsed.webSearch !== false,
      editApproval: parsed.editApproval === "auto" ? "auto" : "manual",
      noticeAccepted: parsed.noticeAccepted === true,
      shell: parseShellModes(parsed.shell)
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
  view: "chat" | "settings" | "history";
  conversations: ConversationMeta[];
  activeId: string | null;
  thread: ThreadItem[];
  /** Text in the composer; kept here so suggestions can fill it. */
  composerText: string;
  setComposerText: (text: string) => void;
  running: boolean;
  /** Messages typed while a turn runs; they go out one by one when it ends. */
  queue: { id: string; text: string }[];
  sessionCostUsd: number;
  costUnknown: boolean;
  models: ModelInfo[] | null;
  modelsFailed: boolean;
  usableSuggested: SuggestedModel[];
  signIn: SignInState;
  workspaceKey: string | null;
  init: () => Promise<void>;
  setView: (view: "chat" | "settings" | "history") => void;
  openConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
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
  enqueue: (text: string) => void;
  unqueue: (id: string) => void;
  /** Interrupt the running turn and send this queued message next. */
  steer: (id: string) => void;
  resolveEdit: (id: string, choice: "apply" | "discard") => Promise<void>;
  resolveDelete: (id: string, choice: "delete" | "keep") => Promise<void>;
  resolveImage: (id: string, choice: "insert" | "discard") => void;
  setShellMode: (mode: ShellMode) => void;
  shellAvailability: ShellAvailability | null;
  refreshShell: () => Promise<void>;
  resolveCommand: (id: string, choice: "run" | "deny") => void;
}

let history: ModelMessage[] = [];
let abort: AbortController | null = null;
let steerNext: string | null = null;
let seq = 0;
/** Bumped whenever the active conversation changes, so late events of an old turn are dropped. */
let convGen = 0;
/** Conversations deleted by the user; a save that was already running must not bring them back. */
const deletedIds = new Set<string>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const pending = new Map<string, { proposal: EditProposal; resolve: (d: EditDecision) => void }>();
const pendingDeletes = new Map<string, { path: string; resolve: (d: DeleteDecision) => void }>();
const pendingImages = new Map<string, { refId: string; image: string; definition: string; resolve: (ok: boolean) => void }>();
const pendingCommands = new Map<string, (run: boolean) => void>();

const SHELL_ERRORS = {
  "no-shell": "error.shell.noShell",
  busy: "error.shell.busy",
  "bad-folder": "error.shell.badFolder",
  "bad-root": "error.shell.badRoot",
  "spawn-failed": "error.shell.spawn"
} as const;

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

  const saveIndex = async (conversations: ConversationMeta[], activeId: string | null) => {
    const key = get().workspaceKey;
    const host = assistantHost();
    if (!key || !host) return;
    await host.history.save(indexKey(key), serializeIndex({ conversations, activeId }));
  };

  /** Writes the active conversation and its index entry. Reads state synchronously. */
  const saveNow = async () => {
    const key = get().workspaceKey;
    const host = assistantHost();
    const { activeId, thread, conversations } = get();
    if (!key || !host || !activeId || thread.length === 0 || deletedIds.has(activeId)) return;
    const previous = conversations.find((c) => c.id === activeId);
    const meta: ConversationMeta = {
      id: activeId,
      title: titleFromThread(thread) || previous?.title || "",
      updatedAt: Date.now()
    };
    const all = [meta, ...conversations.filter((c) => c.id !== activeId)];
    const next = all.slice(0, MAX_CONVERSATIONS);
    set({ conversations: next });
    await host.history.save(conversationKey(key, activeId), serializeThread(thread));
    if (deletedIds.has(activeId)) {
      await host.history.clear(conversationKey(key, activeId));
      return;
    }
    await host.history.save(indexKey(key), serializeIndex({ conversations: next, activeId }));
    // Conversations pushed out of the index would be unreachable: remove their files.
    for (const dropped of all.slice(MAX_CONVERSATIONS)) await host.history.clear(conversationKey(key, dropped.id));
  };

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void saveNow().catch(() => undefined);
    }, 400);
  };

  const flushSave = async () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    await saveNow().catch(() => undefined);
  };

  const resetChat = (activeId: string | null, thread: ThreadItem[]) => {
    convGen += 1;
    steerNext = null;
    history = historyFromThread(thread);
    // A superseded turn no longer owns the run lock: it unwinds on its own.
    abort = null;
    set({ thread, activeId, running: false, queue: [], sessionCostUsd: 0, costUnknown: false });
  };

  const propose = (proposal: EditProposal, signal: AbortSignal | undefined) => {
    const id = proposal.id;
    const item = {
      kind: "edit" as const,
      id,
      path: proposal.path,
      edits: proposal.edits.map((e) => ({ line: e.line, oldText: e.oldText, newText: e.newText })),
      ...(proposal.create ? { create: true as const } : {}),
      status: "pending" as const
    };
    if (get().settings.editApproval === "auto") {
      return (async (): Promise<EditDecision> => {
        if (signal?.aborted) return { status: "rejected" };
        mutateThread((thread) => [...thread, item]);
        const decision = await applyProposal(proposal);
        patchItem(id, { status: decision.status === "applied" ? "applied" : "stale" });
        return decision;
      })();
    }
    return new Promise<EditDecision>((resolve) => {
      mutateThread((thread) => [...thread, item]);
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
  };

  const proposeDelete = async (path: string, signal: AbortSignal | undefined): Promise<DeleteDecision> => {
    const check = await inspectDelete(path);
    if (!check.ok) return { status: "failed", reason: check.reason };
    if (signal?.aborted) return { status: "rejected" };
    const id = nextId("d");
    mutateThread((thread) => [...thread, { kind: "delete", id, path, status: "pending" }]);
    return new Promise<DeleteDecision>((resolve) => {
      pendingDeletes.set(id, { path, resolve });
      signal?.addEventListener(
        "abort",
        () => {
          if (!pendingDeletes.delete(id)) return;
          patchItem(id, { status: "kept" });
          resolve({ status: "rejected" });
        },
        { once: true }
      );
    });
  };

  const generateImage = async (prompt: string, alt: string, signal: AbortSignal | undefined) => {
    const host = assistantHost();
    const targetTabId = useApp.getState().activeTabId;
    if (!host) return { status: "failed" as const, reason: "Image generation is not available here." };
    if (!targetTabId || !useApp.getState().readOpenBuffer({ tabId: targetTabId })) {
      return { status: "failed" as const, reason: t("image.noDocument") };
    }
    const settings = get().settings;
    if (settings.spendCapUsd != null && get().sessionCostUsd >= settings.spendCapUsd) {
      return { status: "failed" as const, reason: t("stop.spendCap") };
    }
    const request = imageGenerationRequest({
      model: settings.imageModelId || DEFAULT_IMAGE_MODEL_ID,
      prompt,
      privacyOnly: settings.privacyOnly,
      zdrOnly: settings.zdrOnly
    });
    let dataUrl = "";
    let refId = "";
    let image = "";
    let definition = "";
    try {
      const response = await host.fetch(request.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.body),
        signal
      });
      const json: unknown = await response.json();
      const parsed = parseGeneratedImage(json);
      if (!response.ok || "error" in parsed) {
        const reason = "error" in parsed ? parsed.error : `Image request failed (${response.status}).`;
        return { status: "failed" as const, reason };
      }
      if (parsed.costUsd != null) set({ sessionCostUsd: get().sessionCostUsd + parsed.costUsd });
      dataUrl = await embedImageSrc(parsed.dataUrl);
      const ref = imageReference(alt, dataUrl);
      refId = ref.id;
      image = ref.image;
      definition = ref.definition;
    } catch (error) {
      if (signal?.aborted) return { status: "rejected" as const };
      return { status: "failed" as const, reason: error instanceof Error ? error.message : "The image request failed." };
    }
    if (signal?.aborted) return { status: "rejected" as const };
    const id = nextId("img");
    mutateThread((thread) => [...thread, { kind: "image", id, alt, prompt, preview: dataUrl, refId, status: "pending" }]);
    const accepted = await new Promise<boolean>((resolve) => {
      pendingImages.set(id, { refId, image, definition, resolve });
      signal?.addEventListener(
        "abort",
        () => {
          if (!pendingImages.delete(id)) return;
          patchItem(id, { status: "discarded", preview: undefined });
          resolve(false);
        },
        { once: true }
      );
    });
    if (!accepted) return { status: "rejected" as const };
    const open = targetTabId ? useApp.getState().readOpenBuffer({ tabId: targetTabId }) : null;
    if (!open) {
      const reason = t("image.noDocument");
      patchItem(id, { status: "failed", preview: undefined, error: reason });
      return { status: "failed" as const, reason };
    }
    const next = `${open.source.replace(/\s*$/, "")}\n\n${image}\n\n${definition}\n`;
    if (!useApp.getState().applyAssistantEdit(open.tabId, next, id)) {
      const reason = t("image.notUpdated");
      patchItem(id, { status: "failed", preview: undefined, error: reason });
      return { status: "failed" as const, reason };
    }
    const tab = useApp.getState().tabs.find((entry) => entry.id === open.tabId);
    const root = useApp.getState().workspace?.root;
    const path = tab?.path && root ? (relativeWorkspacePath(tab.path, root) ?? tab.path) : (tab?.path ?? "the open document");
    patchItem(id, { status: "inserted", preview: undefined, path, refId });
    return { status: "inserted" as const, path, id: refId };
  };

  const onEvent = (event: TurnEvent) => {
    switch (event.type) {
      case "reasoning": {
        mutateThread((thread) => {
          const last = thread[thread.length - 1];
          if (last?.kind === "thought" && last.streaming) {
            return [...thread.slice(0, -1), { ...last, text: last.text + event.text }];
          }
          return [...thread, { kind: "thought", id: nextId("th"), text: event.text, streaming: true }];
        });
        break;
      }
      case "text": {
        mutateThread((thread) => {
          const settled = thread.map((item) =>
            item.kind === "thought" && item.streaming ? { ...item, streaming: false } : item
          );
          const last = settled[settled.length - 1];
          if (last?.kind === "assistant") {
            return [...settled.slice(0, -1), { ...last, text: last.text + event.text }];
          }
          return [...settled, { kind: "assistant", id: nextId("a"), text: event.text }];
        });
        break;
      }
      case "tool-start":
        mutateThread((thread) => [
          ...thread.map((item) => (item.kind === "thought" && item.streaming ? { ...item, streaming: false } : item)),
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
      case "sources": {
        const sites = [
          ...new Set(
            event.sources.map((s) => {
              try {
                return new URL(s.url).hostname.replace(/^www\./, "");
              } catch {
                return "";
              }
            })
          )
        ].filter(Boolean);
        if (sites.length === 0) break;
        const shown = sites.slice(0, 4).join(", ") + (sites.length > 4 ? ` +${sites.length - 4}` : "");
        mutateThread((thread) => [
          ...thread,
          { kind: "tool", id: nextId("w"), name: "webSearch", label: t("tool.webSearch", { sites: shown }), status: "ok" }
        ]);
        break;
      }
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
    conversations: [],
    activeId: null,
    thread: [],
    composerText: "",
    setComposerText: (composerText) => set({ composerText }),
    running: false,
    queue: [],
    sessionCostUsd: 0,
    costUnknown: false,
    models: null,
    modelsFailed: false,
    usableSuggested: SUGGESTED_MODELS,
    signIn: "idle",
    workspaceKey: null,
    shellAvailability: null,

    init: async () => {
      set({ settings: loadSettings() });
      await get().refreshKey();
    },
    setView: (view) => set({ view }),
    updateSettings: (patch) => {
      const previous = get().settings;
      const settings = { ...previous, ...patch };
      const privacyChanged = patch.zdrOnly !== undefined && patch.zdrOnly !== previous.zdrOnly;
      set({ settings, ...(privacyChanged ? { models: null, modelsFailed: false } : {}) });
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
      const zdrOnly = get().settings.zdrOnly;
      try {
        const response = await host.fetch(modelsListUrl(zdrOnly));
        if (!response.ok) throw new Error(String(response.status));
        const models = parseModelList(await response.json());
        if (get().settings.zdrOnly !== zdrOnly) return;
        if (models.length === 0) throw new Error("empty");
        set({
          models,
          modelsFailed: false,
          usableSuggested: checkSuggested(SUGGESTED_MODELS, models).usable
        });
      } catch {
        if (get().settings.zdrOnly !== zdrOnly) return;
        set({ modelsFailed: true, usableSuggested: SUGGESTED_MODELS });
      }
    },
    loadWorkspaceHistory: async (workspaceKey) => {
      const host = assistantHost();
      if (get().workspaceKey === workspaceKey) return;
      get().stop();
      await flushSave();
      set({ workspaceKey, conversations: [] });
      resetChat(null, []);
      if (!host) return;
      try {
        let index = parseIndex(await host.history.load(indexKey(workspaceKey)));
        if (!index) {
          // Chats saved before conversations existed: one thread per workspace.
          const legacy = parseThread(await host.history.load(workspaceKey));
          index = { conversations: [], activeId: null };
          if (legacy.length > 0) {
            const id = nextId("c");
            await host.history.save(conversationKey(workspaceKey, id), serializeThread(legacy));
            index = {
              conversations: [{ id, title: titleFromThread(legacy), updatedAt: Date.now() }],
              activeId: id
            };
            await host.history.save(indexKey(workspaceKey), serializeIndex(index));
            await host.history.clear(workspaceKey);
          }
        }
        const thread = index.activeId
          ? parseThread(await host.history.load(conversationKey(workspaceKey, index.activeId)))
          : [];
        if (get().workspaceKey !== workspaceKey) return;
        set({ conversations: index.conversations });
        resetChat(thread.length > 0 ? index.activeId : null, thread);
      } catch {
        /* start empty */
      }
    },
    openConversation: async (id) => {
      const host = assistantHost();
      const key = get().workspaceKey;
      if (!host || !key) return;
      if (id === get().activeId) return set({ view: "chat" });
      get().stop();
      await flushSave();
      try {
        const thread = parseThread(await host.history.load(conversationKey(key, id)));
        if (get().workspaceKey !== key) return;
        resetChat(id, thread);
        set({ view: "chat" });
        await saveIndex(get().conversations, id);
      } catch {
        /* keep the current chat */
      }
    },
    deleteConversation: async (id) => {
      const host = assistantHost();
      const key = get().workspaceKey;
      if (!host || !key) return;
      if (id === get().activeId) {
        get().stop();
        if (saveTimer) {
          clearTimeout(saveTimer);
          saveTimer = null;
        }
        resetChat(null, []);
      }
      deletedIds.add(id);
      const conversations = get().conversations.filter((c) => c.id !== id);
      set({ conversations });
      try {
        await host.history.clear(conversationKey(key, id));
        await saveIndex(conversations, get().activeId);
      } catch {
        /* best effort */
      }
    },
    newChat: () => {
      get().stop();
      void flushSave().then(() => saveIndex(get().conversations, null)).catch(() => undefined);
      resetChat(null, []);
      set({ view: "chat" });
    },
    clearHistory: async () => {
      get().stop();
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      const key = get().workspaceKey;
      const host = assistantHost();
      const ids = get().conversations.map((c) => c.id);
      for (const id of ids) deletedIds.add(id);
      resetChat(null, []);
      set({ conversations: [] });
      if (!key || !host) return;
      for (const id of ids) await host.history.clear(conversationKey(key, id));
      await host.history.clear(indexKey(key));
      await host.history.clear(key);
    },
    stop: () => abort?.abort(),
    enqueue: (text) => {
      const trimmed = redactKeys(text.trim());
      if (!trimmed) return;
      set((s) => ({ queue: [...s.queue, { id: nextId("q"), text: trimmed }] }));
    },
    unqueue: (id) => set((s) => ({ queue: s.queue.filter((q) => q.id !== id) })),
    steer: (id) => {
      const item = get().queue.find((q) => q.id === id);
      if (!item) return;
      // The steered message jumps the line and goes out as soon as the turn unwinds.
      steerNext = item.text;
      set((s) => ({ queue: s.queue.filter((q) => q.id !== id) }));
      if (abort) abort.abort();
      else {
        steerNext = null;
        void get().send(item.text);
      }
    },
    setShellMode: (mode) => {
      const key = get().workspaceKey;
      if (!key || !getHost().assistant?.shell) return;
      const shell = { ...get().settings.shell };
      if (mode === "off") delete shell[key];
      else shell[key] = mode;
      get().updateSettings({ shell });
    },
    refreshShell: async () => {
      const api = assistantHost()?.shell;
      if (!api) return set({ shellAvailability: null });
      try {
        set({ shellAvailability: await api.available() });
      } catch {
        set({ shellAvailability: { bash: false, powershell: false } });
      }
    },
    resolveCommand: (id, choice) => {
      const resolve = pendingCommands.get(id);
      if (!resolve) return;
      pendingCommands.delete(id);
      resolve(choice === "run");
    },
    send: async (text) => {
      const host = assistantHost();
      // A pasted OpenRouter key is a mistake: never store it or send it on.
      const trimmed = redactKeys(text.trim());
      const state = get();
      if (!host || !trimmed || state.running || !state.key?.hasKey || !state.settings.noticeAccepted) return;
      const controller = new AbortController();
      abort = controller;
      if (!get().activeId) set({ activeId: nextId("c") });
      const gen = convGen;
      set({ running: true });
      mutateThread((thread) => [...thread, { kind: "user", id: nextId("u"), text: trimmed }]);
      useApp.getState().flushPendingEdits();
      const info = state.models?.find((m) => m.id === state.settings.modelId) ?? null;
      try {
        // The AI SDK is large: load it on the first message, not with the app.
        const { createAssistantModel, runAssistantTurn, classifyCommand } = await import("@mdword/agent/runtime");
        const model = createAssistantModel({
          apiKey: "host-managed",
          modelId: state.settings.modelId,
          privacyOnly: state.settings.privacyOnly,
          zdrOnly: state.settings.zdrOnly,
          webSearch: state.settings.webSearch,
          fetch: (input, init) =>
            host.fetch(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, init)
        });
        const classifierModel = createAssistantModel({
          apiKey: "host-managed",
          modelId: state.settings.modelId,
          privacyOnly: state.settings.privacyOnly,
          zdrOnly: state.settings.zdrOnly,
          fetch: (input, init) =>
            host.fetch(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, init)
        });
        const mentioned = mentionedPaths(trimmed, mentionFiles().map((f) => f.rel));
        const shellApi = host.shell;
        const root = useApp.getState().workspace?.root;
        const commandsOn = Boolean(shellApi && root && shellModeOf(get()) !== "off");
        const runCommand = async (req: CommandRequest, signal: AbortSignal | undefined): Promise<CommandOutcome> => {
          const mode = shellModeOf(get());
          if (!shellApi || !root || mode === "off") return { status: "failed", reason: t("error.shell.badRoot") };
          const id = nextId("cmd");
          // "Always" has no model, so the fixed filter decides. "AI" does not use it:
          // the classifier sees only the command and decides on its own.
          const policy = checkCommand(req.command, req.shell);
          let approval: "manual" | "ai" | "always" = "manual";
          let why: Extract<ThreadItem, { kind: "command" }>["why"];
          if (mode === "ai") {
            const verdict = await classifyCommand({
              model: classifierModel,
              command: req.command,
              shell: req.shell,
              folder: req.folder,
              signal
            });
            if (verdict.decision === "allow") approval = "ai";
            else why = { kind: "ai", reason: verdict.reason };
          } else if (mode === "always") {
            if (policy.auto) approval = "always";
            else why = { kind: "filter", reason: policy.reason };
          } else if (!policy.auto) {
            why = { kind: "filter", reason: policy.reason };
          }
          if (signal?.aborted) return { status: "denied" };
          mutateThread((thread) => [
            ...thread,
            {
              kind: "command",
              id,
              shell: req.shell,
              command: req.command,
              folder: req.folder,
              approval,
              ...(approval === "manual" && mode !== "manual" ? { why } : {}),
              timeoutMs: req.timeoutMs,
              status: approval === "manual" ? "pending" : "running"
            }
          ]);
          if (approval === "manual") {
            const allowed = await new Promise<boolean>((resolve) => {
              pendingCommands.set(id, resolve);
              signal?.addEventListener(
                "abort",
                () => {
                  if (pendingCommands.delete(id)) resolve(false);
                },
                { once: true }
              );
            });
            if (!allowed) {
              patchItem(id, { status: "denied" });
              return { status: "denied" };
            }
            patchItem(id, { status: "running" });
          }
          const onAbort = () => void shellApi.cancel(id).catch(() => undefined);
          signal?.addEventListener("abort", onAbort, { once: true });
          try {
            const result = await shellApi.run({
              id,
              shell: req.shell,
              command: req.command,
              root,
              folder: req.folder,
              timeoutMs: req.timeoutMs
            });
            if (!result.ok) {
              const reason = t(SHELL_ERRORS[result.error]);
              patchItem(id, { status: "failed", error: reason });
              return { status: "failed", reason };
            }
            patchItem(id, {
              status: "done",
              exitCode: result.exitCode,
              durationMs: result.durationMs,
              timedOut: result.timedOut,
              cancelled: result.cancelled,
              changed: result.changed,
              output: result.output
            });
            if (result.changed.length > 0) await useApp.getState().refreshWorkspace();
            return { status: "ran", ...result };
          } catch {
            const reason = t("error.shell.spawn");
            patchItem(id, { status: "failed", error: reason });
            return { status: "failed", reason };
          } finally {
            signal?.removeEventListener("abort", onAbort);
          }
        };
        const result = await runAssistantTurn({
          model,
          history,
          userText: trimmed,
          context: [buildTurnContext(), await attachedFilesContext(mentioned)]
            .filter(Boolean)
            .join("\n\n"),
          env: createAssistantEnv({ propose, proposeDelete, generateImage, mentioned, ...(commandsOn ? { runCommand } : {}) }),
          pricing: info,
          spentBeforeUsd: get().sessionCostUsd,
          spendCapUsd: state.settings.spendCapUsd,
          webSearch: state.settings.webSearch,
          instructions: await loadInstructionFiles(),
          signal: controller.signal,
          onEvent: (event) => {
            if (gen === convGen) onEvent(event);
          }
        });
        if (gen === convGen) history = result.history;
      } catch {
        if (gen === convGen) mutateThread((thread) => [...thread, { kind: "notice", id: nextId("n"), text: t("error.unknown") }]);
      } finally {
        // Only the turn that still owns the conversation cleans up shared state.
        if (gen === convGen) {
          for (const [id, resolve] of pendingCommands) {
            pendingCommands.delete(id);
            patchItem(id, { status: "denied" });
            resolve(false);
          }
          for (const [id, entry] of pending) {
            pending.delete(id);
            patchItem(id, { status: "discarded" });
            entry.resolve({ status: "rejected" });
          }
          for (const [id, entry] of pendingDeletes) {
            pendingDeletes.delete(id);
            patchItem(id, { status: "kept" });
            entry.resolve({ status: "rejected" });
          }
          for (const [id, entry] of pendingImages) {
            pendingImages.delete(id);
            patchItem(id, { status: "discarded", preview: undefined });
            entry.resolve(false);
          }
          if (abort === controller) abort = null;
          set({ running: false });
          // Steering sends its message at once. A normal finish sends the next queued one;
          // a manual stop keeps the queue so nothing goes out unasked.
          const steered = steerNext;
          steerNext = null;
          const next = steered ?? (controller.signal.aborted ? undefined : get().queue[0]?.text);
          if (steered === null && next !== undefined) set((s) => ({ queue: s.queue.slice(1) }));
          if (next !== undefined) queueMicrotask(() => gen === convGen && void get().send(next));
        }
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
    },
    resolveDelete: async (id, choice) => {
      const entry = pendingDeletes.get(id);
      if (!entry) return;
      pendingDeletes.delete(id);
      if (choice === "keep") {
        patchItem(id, { status: "kept" });
        entry.resolve({ status: "rejected" });
        return;
      }
      const decision = await deleteConfirmedFile(entry.path);
      patchItem(id, {
        status: decision.status === "deleted" ? "deleted" : "failed",
        ...(decision.status === "failed" ? { error: decision.reason } : {})
      });
      entry.resolve(decision);
    },
    resolveImage: (id, choice) => {
      const entry = pendingImages.get(id);
      if (!entry) return;
      pendingImages.delete(id);
      if (choice === "discard") patchItem(id, { status: "discarded", preview: undefined });
      entry.resolve(choice === "insert");
    }
  };
});

export { t };

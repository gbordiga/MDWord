import { maskKey, type AssistantHostApi } from "@mdword/shared";

const KEY_NAME = "mdword.assistant.openrouterKey";
const ORIGIN = "https://openrouter.ai/";

export interface HistoryStorage {
  getHistory(key: string): Promise<string | undefined>;
  setHistory(key: string, value: string): Promise<void>;
  deleteHistory(key: string): Promise<void>;
}

function readKey(): string | null {
  try {
    return localStorage.getItem(KEY_NAME);
  } catch {
    return null;
  }
}

/**
 * Browser implementation. The key lives in localStorage: the CSP limits where
 * a script could send it (openrouter.ai only), and settings suggest a
 * dedicated key with a limit.
 */
export function createWebAssistantHost(storage: HistoryStorage): AssistantHostApi {
  return {
    keyStorage: "browser",
    async keyStatus() {
      const key = readKey();
      return { hasKey: Boolean(key), masked: key ? maskKey(key) : null };
    },
    async saveKey(key) {
      localStorage.setItem(KEY_NAME, key.trim());
    },
    async clearKey() {
      localStorage.removeItem(KEY_NAME);
    },
    async fetch(url, init) {
      if (!url.startsWith(ORIGIN)) throw new Error("Only openrouter.ai is allowed.");
      const key = readKey();
      if (!key) throw new Error("No OpenRouter key is saved.");
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${key}`);
      return fetch(url, { ...init, headers });
    },
    history: {
      async load(workspaceKey) {
        return (await storage.getHistory(workspaceKey)) ?? null;
      },
      async save(workspaceKey, json) {
        await storage.setHistory(workspaceKey, json);
      },
      async clear(workspaceKey) {
        await storage.deleteHistory(workspaceKey);
      }
    }
  };
}

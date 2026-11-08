import { app, ipcMain, net, safeStorage, shell, type WebContents } from "electron";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { z } from "zod";
import { maskKey, looksLikeKey } from "@mdword/shared";
import {
  MAX_HISTORY_BYTES,
  MAX_REQUEST_BODY_BYTES,
  SecureStorageUnavailable,
  authUrl,
  createPkce,
  forwardableHeaders,
  historyFileName,
  isOpenRouterUrl,
  readStoredKey,
  writeStoredKey,
  type BlobFile,
  type SecretBox
} from "./assistantCore";

const box: SecretBox = {
  isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
  backend: () => {
    const get = (safeStorage as unknown as { getSelectedStorageBackend?: () => string }).getSelectedStorageBackend;
    return typeof get === "function" ? get.call(safeStorage) : undefined;
  },
  encryptString: (v) => safeStorage.encryptString(v),
  decryptString: (b) => safeStorage.decryptString(b)
};

const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000;

function keyFile(): BlobFile {
  const file = path.join(app.getPath("userData"), "assistant", "openrouter.key");
  return {
    read: async () => {
      try {
        return await fs.readFile(file);
      } catch {
        return null;
      }
    },
    write: async (data) => {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, data, { mode: 0o600 });
    },
    remove: async () => {
      await fs.rm(file, { force: true });
    }
  };
}

function historyPath(workspaceKey: string): string {
  return path.join(app.getPath("userData"), "assistant-history", historyFileName(workspaceKey));
}

const requests = new Map<string, AbortController>();
let signInServer: http.Server | null = null;
let cancelSignIn: (() => void) | null = null;

const initSchema = z.object({
  method: z.enum(["GET", "POST"]).optional(),
  headers: z.array(z.tuple([z.string(), z.string()])).optional(),
  body: z.string().max(MAX_REQUEST_BODY_BYTES).optional()
});

async function startRequest(sender: WebContents, id: string, url: string, rawInit: unknown) {
  if (!isOpenRouterUrl(url)) throw new Error("Only openrouter.ai is allowed.");
  const init = initSchema.parse(rawInit ?? {});
  const key = await readStoredKey(box, keyFile());
  if (!key) throw new Error("No OpenRouter key is saved.");
  if (requests.has(id)) throw new Error("Duplicate request id.");
  const controller = new AbortController();
  requests.set(id, controller);
  const headers = { ...forwardableHeaders(init.headers ?? []), authorization: `Bearer ${key}` };
  let response: Response;
  try {
    response = await net.fetch(url, {
      method: init.method ?? "GET",
      headers,
      body: init.body,
      signal: controller.signal,
      redirect: "error"
    });
  } catch (error) {
    requests.delete(id);
    throw error;
  }
  const outHeaders: [string, string][] = [];
  response.headers.forEach((value, name) => {
    if (name.toLowerCase() !== "set-cookie") outHeaders.push([name, value]);
  });
  // The body is pumped after the headers are returned, as events the renderer already listens for.
  void (async () => {
    const send = (event: unknown) => {
      if (!sender.isDestroyed()) sender.send("assistant.requestEvent", event);
    };
    try {
      if (response.body) {
        const reader = response.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          send({ id, type: "chunk", data: value });
        }
      }
      send({ id, type: "end" });
    } catch (error) {
      send({ id, type: "error", message: controller.signal.aborted ? "aborted" : String((error as Error)?.message ?? error) });
    } finally {
      requests.delete(id);
    }
  })();
  return { status: response.status, statusText: response.statusText, headers: outHeaders };
}

const successPage = (title: string, body: string) =>
  `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem"><h1 style="font-size:1.25rem">${title}</h1><p>${body}</p>`;

async function signIn(): Promise<{ ok: boolean; cancelled?: boolean }> {
  cancelSignIn?.();
  const { verifier, challenge } = createPkce();
  return new Promise((resolve) => {
    let settled = false;
    const server = http.createServer();
    const finish = (result: { ok: boolean; cancelled?: boolean }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      server.close();
      server.closeAllConnections?.();
      if (signInServer === server) signInServer = null;
      cancelSignIn = null;
      resolve(result);
    };
    const timer = setTimeout(() => finish({ ok: false }), SIGN_IN_TIMEOUT_MS);
    cancelSignIn = () => finish({ ok: false, cancelled: true });
    signInServer = server;

    server.on("request", (req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }
      const code = url.searchParams.get("code");
      if (!code) {
        res.writeHead(400, { "content-type": "text/html; charset=utf-8" }).end(successPage("Sign in failed", "No code was returned. You can close this tab."));
        return;
      }
      void (async () => {
        try {
          const response = await net.fetch("https://openrouter.ai/api/v1/auth/keys", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: "S256" }),
            redirect: "error"
          });
          const body = (await response.json()) as { key?: unknown };
          if (!response.ok || typeof body.key !== "string" || !looksLikeKey(body.key)) throw new Error("exchange failed");
          await writeStoredKey(box, keyFile(), body.key);
          res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(successPage("Signed in", "You can close this tab and return to MDWord."));
          finish({ ok: true });
        } catch {
          res.writeHead(500, { "content-type": "text/html; charset=utf-8" }).end(successPage("Sign in failed", "You can close this tab and paste a key in MDWord instead."));
          finish({ ok: false });
        }
      })();
    });
    server.on("error", () => finish({ ok: false }));
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return finish({ ok: false });
      void shell.openExternal(authUrl(challenge, `http://localhost:${address.port}/callback`)).catch(() => finish({ ok: false }));
    });
  });
}

export function registerAssistantIpc(): void {
  ipcMain.handle("assistant.keyStatus", async () => {
    const key = await readStoredKey(box, keyFile());
    return { hasKey: Boolean(key), masked: key ? maskKey(key) : null };
  });

  ipcMain.handle("assistant.saveKey", async (_e, value: unknown) => {
    const key = z.string().max(512).parse(value).trim();
    if (!looksLikeKey(key)) throw new Error("invalid-key");
    try {
      await writeStoredKey(box, keyFile(), key);
    } catch (error) {
      if (error instanceof SecureStorageUnavailable) throw new Error("secure-storage-unavailable");
      throw error;
    }
  });

  ipcMain.handle("assistant.clearKey", async () => {
    await keyFile().remove();
  });

  ipcMain.handle("assistant.signIn", () => signIn());
  ipcMain.handle("assistant.cancelSignIn", () => {
    cancelSignIn?.();
  });

  ipcMain.handle("assistant.requestStart", (e, payload: unknown) => {
    const parsed = z.object({ id: z.string().max(64), url: z.string().max(2048), init: z.unknown() }).parse(payload);
    return startRequest(e.sender, parsed.id, parsed.url, parsed.init);
  });
  ipcMain.handle("assistant.requestAbort", (_e, id: unknown) => {
    requests.get(z.string().parse(id))?.abort();
  });

  ipcMain.handle("assistant.history.load", async (_e, workspaceKey: unknown) => {
    try {
      return await fs.readFile(historyPath(z.string().max(4096).parse(workspaceKey)), "utf8");
    } catch {
      return null;
    }
  });
  ipcMain.handle("assistant.history.save", async (_e, payload: unknown) => {
    const { key, json } = z.object({ key: z.string().max(4096), json: z.string().max(MAX_HISTORY_BYTES) }).parse(payload);
    const file = historyPath(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, json, "utf8");
  });
  ipcMain.handle("assistant.history.clear", async (_e, key: unknown) => {
    await fs.rm(historyPath(z.string().max(4096).parse(key)), { force: true });
  });
}

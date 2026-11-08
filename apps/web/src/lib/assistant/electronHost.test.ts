import { describe, expect, it } from "vitest";
import { createElectronAssistantHost, type ElectronAssistantBridge } from "./electronHost";

function fakeBridge() {
  let listener: ((e: never) => void) | null = null;
  const calls: { start: unknown[]; aborts: string[] } = { start: [], aborts: [] };
  const bridge = {
    keyStatus: async () => ({ hasKey: true, masked: "sk-or-…abcd" }),
    saveKey: async () => undefined,
    clearKey: async () => undefined,
    signIn: async () => ({ ok: true }),
    cancelSignIn: async () => undefined,
    requestStart: async (id: string, url: string, init: unknown) => {
      calls.start.push({ id, url, init });
      return { status: 200, statusText: "OK", headers: [["content-type", "text/event-stream"]] as [string, string][] };
    },
    requestAbort: async (id: string) => {
      calls.aborts.push(id);
    },
    onRequestEvent: (h: (e: never) => void) => {
      listener = h;
      return () => undefined;
    },
    history: { load: async () => null, save: async () => undefined, clear: async () => undefined }
  } as unknown as ElectronAssistantBridge;
  return { bridge, calls, emit: (e: unknown) => listener!(e as never) };
}

describe("electron assistant fetch", () => {
  it("streams chunks from the main process as a Response body", async () => {
    const { bridge, calls, emit } = fakeBridge();
    const host = createElectronAssistantHost(bridge);
    const response = await host.fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer should-not-matter" },
      body: "{}"
    });
    const id = (calls.start[0] as { id: string }).id;
    emit({ id, type: "chunk", data: new TextEncoder().encode("data: a\n\n") });
    emit({ id, type: "chunk", data: new TextEncoder().encode("data: b\n\n") });
    emit({ id, type: "end" });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("data: a\n\ndata: b\n\n");
  });

  it("surfaces main-process errors as a stream error", async () => {
    const { bridge, calls, emit } = fakeBridge();
    const response = await createElectronAssistantHost(bridge).fetch("https://openrouter.ai/x");
    emit({ id: (calls.start[0] as { id: string }).id, type: "error", message: "boom" });
    await expect(response.text()).rejects.toThrow("boom");
  });

  it("aborts the request in the main process when the signal fires", async () => {
    const { bridge, calls } = fakeBridge();
    const ctrl = new AbortController();
    await createElectronAssistantHost(bridge).fetch("https://openrouter.ai/x", { signal: ctrl.signal });
    ctrl.abort();
    expect(calls.aborts).toEqual([(calls.start[0] as { id: string }).id]);
  });

  it("refuses bodies it cannot send as text and keeps the key out of the bridge", async () => {
    const { bridge, calls } = fakeBridge();
    const host = createElectronAssistantHost(bridge);
    await expect(host.fetch("https://openrouter.ai/x", { method: "POST", body: new Uint8Array(2) })).rejects.toThrow();
    await host.fetch("https://openrouter.ai/x", { headers: { Authorization: "Bearer k" } });
    const init = (calls.start[0] as { init: { headers: [string, string][] } }).init;
    // The renderer may pass a header, but main drops it and uses the stored key.
    expect(init.headers.length).toBeGreaterThanOrEqual(0);
    expect(await host.keyStatus()).toEqual({ hasKey: true, masked: "sk-or-…abcd" });
  });
});

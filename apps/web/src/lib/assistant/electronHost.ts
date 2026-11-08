import type { AssistantHostApi } from "@mdword/shared";

type RequestEvent =
  | { id: string; type: "chunk"; data: Uint8Array }
  | { id: string; type: "end" }
  | { id: string; type: "error"; message: string };

/** What the Electron preload exposes. The key never crosses this bridge in either direction. */
export interface ElectronAssistantBridge {
  keyStatus(): Promise<{ hasKey: boolean; masked: string | null }>;
  saveKey(key: string): Promise<void>;
  clearKey(): Promise<void>;
  signIn(): Promise<{ ok: boolean; cancelled?: boolean }>;
  cancelSignIn(): Promise<void>;
  requestStart(
    id: string,
    url: string,
    init: { method?: string; headers?: [string, string][]; body?: string }
  ): Promise<{ status: number; statusText: string; headers: [string, string][] }>;
  requestAbort(id: string): Promise<void>;
  onRequestEvent(handler: (event: RequestEvent) => void): () => void;
  history: AssistantHostApi["history"];
}

let counter = 0;

export function createElectronAssistantHost(bridge: ElectronAssistantBridge): AssistantHostApi {
  const streams = new Map<string, ReadableStreamDefaultController<Uint8Array>>();
  bridge.onRequestEvent((event) => {
    const controller = streams.get(event.id);
    if (!controller) return;
    if (event.type === "chunk") {
      controller.enqueue(event.data);
      return;
    }
    streams.delete(event.id);
    if (event.type === "end") controller.close();
    else controller.error(new DOMException(event.message, event.message === "aborted" ? "AbortError" : "NetworkError"));
  });

  return {
    keyStorage: "system",
    keyStatus: () => bridge.keyStatus(),
    saveKey: (key) => bridge.saveKey(key),
    clearKey: () => bridge.clearKey(),
    signIn: () => bridge.signIn(),
    cancelSignIn: () => bridge.cancelSignIn(),
    history: bridge.history,
    async fetch(url, init) {
      counter += 1;
      const id = `req-${Date.now().toString(36)}-${counter}`;
      if (init?.signal?.aborted) throw new DOMException("aborted", "AbortError");
      if (init?.body != null && typeof init.body !== "string") throw new Error("Unsupported request body.");
      const headers: [string, string][] = [];
      new Headers(init?.headers).forEach((value, name) => headers.push([name, value]));
      let controller!: ReadableStreamDefaultController<Uint8Array>;
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          controller = c;
        },
        cancel() {
          streams.delete(id);
          void bridge.requestAbort(id);
        }
      });
      // Register before the request starts so no chunk can arrive unclaimed.
      streams.set(id, controller);
      const onAbort = () => void bridge.requestAbort(id);
      init?.signal?.addEventListener("abort", onAbort, { once: true });
      try {
        const head = await bridge.requestStart(id, url, {
          method: init?.method,
          headers,
          body: init?.body as string | undefined
        });
        const nullBody = head.status === 204 || head.status === 205 || head.status === 304;
        if (nullBody) {
          streams.delete(id);
          return new Response(null, { status: head.status, statusText: head.statusText, headers: head.headers });
        }
        return new Response(body, { status: head.status, statusText: head.statusText, headers: head.headers });
      } catch (error) {
        streams.delete(id);
        throw error;
      }
    }
  };
}

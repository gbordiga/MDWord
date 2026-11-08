import { describe, expect, it } from "vitest";
import {
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

function memoryFile(): BlobFile & { data: Buffer | null } {
  const file = {
    data: null as Buffer | null,
    read: async () => file.data,
    write: async (d: Buffer) => {
      file.data = d;
    },
    remove: async () => {
      file.data = null;
    }
  };
  return file;
}

const fakeBox = (available = true, backend?: string): SecretBox => ({
  isEncryptionAvailable: () => available,
  backend: () => backend,
  encryptString: (v) => Buffer.from(`enc:${v}`.split("").reverse().join("")),
  decryptString: (b) => b.toString().split("").reverse().join("").replace(/^enc:/, "")
});

describe("key store", () => {
  it("stores the key encrypted, never as plain text", async () => {
    const file = memoryFile();
    await writeStoredKey(fakeBox(), file, "sk-or-v1-secretsecretsecret");
    expect(file.data!.toString()).not.toContain("secretsecret");
    expect(await readStoredKey(fakeBox(), file)).toBe("sk-or-v1-secretsecretsecret");
  });

  it("refuses to store when there is no secure backend", async () => {
    await expect(writeStoredKey(fakeBox(false), memoryFile(), "k")).rejects.toBeInstanceOf(SecureStorageUnavailable);
    await expect(writeStoredKey(fakeBox(true, "basic_text"), memoryFile(), "k")).rejects.toBeInstanceOf(
      SecureStorageUnavailable
    );
  });

  it("reads nothing when the file is missing or cannot be decrypted", async () => {
    expect(await readStoredKey(fakeBox(), memoryFile())).toBeNull();
    const file = memoryFile();
    file.data = Buffer.from("garbage");
    const throwing: SecretBox = { ...fakeBox(), decryptString: () => { throw new Error("bad"); } };
    expect(await readStoredKey(throwing, file)).toBeNull();
  });
});

describe("request proxy rules", () => {
  it("allows only https://openrouter.ai", () => {
    expect(isOpenRouterUrl("https://openrouter.ai/api/v1/chat/completions")).toBe(true);
    for (const bad of [
      "http://openrouter.ai/api",
      "https://openrouter.ai.evil.com/api",
      "https://evil.com/openrouter.ai",
      "https://user@openrouter.ai/api",
      "https://openrouter.ai:8443/api",
      "file:///etc/passwd",
      "not a url"
    ]) {
      expect(isOpenRouterUrl(bad)).toBe(false);
    }
  });

  it("forwards only an allowlist of headers and drops Authorization and cookies", () => {
    expect(
      forwardableHeaders([
        ["Content-Type", "application/json"],
        ["Authorization", "Bearer attacker"],
        ["Cookie", "a=b"],
        ["Host", "evil"],
        ["X-Title", "MDWord"]
      ])
    ).toEqual({ "content-type": "application/json", "x-title": "MDWord" });
  });
});

describe("sign in and history helpers", () => {
  it("builds a PKCE pair and an auth URL for the loopback callback", () => {
    const a = createPkce();
    expect(a.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const url = new URL(authUrl(a.challenge, "http://localhost:5555/callback"));
    expect(url.origin).toBe("https://openrouter.ai");
    expect(url.searchParams.get("callback_url")).toBe("http://localhost:5555/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("maps a workspace key to a fixed-length file name, so paths cannot escape", () => {
    expect(historyFileName("../../etc/passwd")).toMatch(/^[0-9a-f]{64}\.json$/);
    expect(historyFileName("a")).not.toBe(historyFileName("b"));
  });
});

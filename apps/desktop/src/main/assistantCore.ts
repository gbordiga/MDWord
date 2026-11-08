import { createHash, randomBytes } from "node:crypto";

/** Electron's `safeStorage`, reduced to what the key store needs (and what tests can fake). */
export interface SecretBox {
  isEncryptionAvailable(): boolean;
  /** "basic_text" means no real keyring on Linux: the key would sit in plain text. */
  backend?(): string | undefined;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}

export interface BlobFile {
  read(): Promise<Buffer | null>;
  write(data: Buffer): Promise<void>;
  remove(): Promise<void>;
}

export class SecureStorageUnavailable extends Error {
  constructor() {
    super("No secure storage is available on this system.");
    this.name = "SecureStorageUnavailable";
  }
}

function usable(box: SecretBox): boolean {
  if (!box.isEncryptionAvailable()) return false;
  const backend = box.backend?.();
  return backend !== "basic_text";
}

export async function readStoredKey(box: SecretBox, file: BlobFile): Promise<string | null> {
  const data = await file.read();
  if (!data || !usable(box)) return null;
  try {
    const key = box.decryptString(data);
    return key || null;
  } catch {
    return null;
  }
}

export async function writeStoredKey(box: SecretBox, file: BlobFile, key: string): Promise<void> {
  if (!usable(box)) throw new SecureStorageUnavailable();
  await file.write(box.encryptString(key));
}

const ORIGIN_HOST = "openrouter.ai";

/** The assistant may only talk to https://openrouter.ai. Nothing else is proxied. */
export function isOpenRouterUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname === ORIGIN_HOST && url.port === "" && !url.username;
  } catch {
    return false;
  }
}

const FORWARDED_HEADERS = new Set(["content-type", "accept", "x-title", "http-referer", "accept-language"]);

/** Only a short allowlist of request headers is forwarded; Authorization is always the stored key. */
export function forwardableHeaders(entries: [string, string][]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of entries) {
    const lower = name.toLowerCase();
    if (FORWARDED_HEADERS.has(lower)) out[lower] = value;
  }
  return out;
}

export function historyFileName(workspaceKey: string): string {
  return `${createHash("sha256").update(workspaceKey).digest("hex")}.json`;
}

export interface Pkce {
  verifier: string;
  challenge: string;
}

export function createPkce(): Pkce {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function authUrl(challenge: string, callbackUrl: string): string {
  const url = new URL(`https://${ORIGIN_HOST}/auth`);
  url.searchParams.set("callback_url", callbackUrl);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export const MAX_REQUEST_BODY_BYTES = 8 * 1024 * 1024;
export const MAX_HISTORY_BYTES = 5 * 1024 * 1024;

import { OPENROUTER_ORIGIN } from "./origin";

export interface PkcePair {
  verifier: string;
  challenge: string;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 32 random bytes for the verifier, SHA-256 of it for the challenge (S256). */
export async function createPkce(): Promise<PkcePair> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const verifier = base64Url(bytes);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

export function buildAuthUrl(challenge: string, callbackUrl?: string): string {
  const url = new URL(`${OPENROUTER_ORIGIN}/auth`);
  if (callbackUrl) url.searchParams.set("callback_url", callbackUrl);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

/** Trade the single-use code for the user's key. Resolves to the key or throws. */
export async function exchangeCode(
  code: string,
  verifier: string,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const response = await fetchImpl(`${OPENROUTER_ORIGIN}/api/v1/auth/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: "S256" })
  });
  if (!response.ok) throw new Error(`OpenRouter sign-in failed (${response.status}).`);
  const body = (await response.json()) as { key?: unknown };
  if (typeof body.key !== "string" || body.key === "") throw new Error("OpenRouter returned no key.");
  return body.key;
}

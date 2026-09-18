const MATH_BLOCK_LANGS = new Set(["math", "latex", "equation"]);

export function isMathBlockLanguage(lang: unknown): boolean {
  return MATH_BLOCK_LANGS.has(String(lang ?? "").trim().toLowerCase());
}

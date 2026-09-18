import type { GenericNode } from "./constants";

const MERMAID_LANGS = new Set(["mermaid", "mmd"]);

export function isMermaidLanguage(lang: unknown): boolean {
  return MERMAID_LANGS.has(String(lang ?? "").trim().toLowerCase());
}

export function isMermaidAstNode(node: GenericNode): boolean {
  if (node.type === "mermaid") return true;
  if ((node.type === "code" || node.type === "codeBlock") && isMermaidLanguage(node.lang)) return true;
  return node.type === "mystDirective" && String(node.name ?? "").toLowerCase() === "mermaid";
}

export function mermaidSourceFromNode(node: GenericNode): string {
  if (typeof node.value === "string" && node.value.length) return node.value.replace(/\n$/, "");
  const parts: string[] = [];
  for (const child of node.children ?? []) {
    if (typeof child.value === "string") parts.push(child.value);
    else if (child.children?.length) parts.push(mermaidSourceFromNode(child));
  }
  return parts.join("\n").replace(/\n$/, "");
}

import type { Mdoc } from "@mdword/layout-engine";
import { resolveRunningForPrint } from "@mdword/layout-engine";

type Running = { left?: string; center?: string; right?: string };

export type RunningVars = {
  title?: string;
  subtitle?: string;
  author?: string;
  date?: string;
  filename?: string;
};

function hasPageToken(template: string): boolean {
  return /\{\{\s*pages?\s*\}\}/.test(template);
}

/** Resolve metadata, then turn remaining page tokens into CSS counter() expressions. */
export function cssContentValue(template: string, vars?: RunningVars): string | null {
  if (!template) return null;
  const resolved = vars ? resolveRunningForPrint(template, vars) : template;
  const parts = resolved.split(/(\{\{page\}\}|\{\{pages\}\})/g).filter((part) => part.length > 0);
  if (!parts.length) return null;
  return parts
    .map((part) => {
      if (part === "{{page}}") return "counter(page)";
      if (part === "{{pages}}") return "counter(pages)";
      return JSON.stringify(part);
    })
    .join(" ");
}

export function pageMarginCss(
  header: Running,
  footer: Running,
  vars?: RunningVars,
  options?: { pageTokensOnly?: boolean }
): string {
  const rules: string[] = [];
  const box = (name: string, template: string | undefined) => {
    const raw = template ?? "";
    if (options?.pageTokensOnly && !hasPageToken(raw)) return;
    const expr = cssContentValue(raw, vars);
    if (!expr) return;
    rules.push(`@${name} { content: ${expr}; font-size: 9pt; color: #444; }`);
  };
  box("top-left", header.left);
  box("top-center", header.center);
  box("top-right", header.right);
  box("bottom-left", footer.left);
  box("bottom-center", footer.center);
  box("bottom-right", footer.right);
  return rules.join("\n      ");
}

function withoutPageTokens(template: string, vars: RunningVars): string {
  return resolveRunningForPrint(template, vars)
    .replace(/\{\{\s*pages?\s*\}\}/g, "")
    .replace(/\s*\/\s*$/g, "")
    .replace(/^\s*\/\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function runningBarsHtml(
  header: Running,
  footer: Running,
  vars: RunningVars
): { header: string; footer: string } {
  const cell = (template: string) => `<span>${escapeHtml(withoutPageTokens(template, vars))}</span>`;
  return {
    header: `<div class="print-running print-running-header">${cell(header.left ?? "")}${cell(header.center ?? "")}${cell(header.right ?? "")}</div>`,
    footer: `<div class="print-running print-running-footer">${cell(footer.left ?? "")}${cell(footer.center ?? "")}${cell(footer.right ?? "")}</div>`
  };
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function resolvedRunningComments(mdoc: Mdoc, vars: RunningVars): string {
  const header = mdoc.header ?? {};
  const footer = mdoc.footer ?? {};
  const resolve = (template: string) => resolveRunningForPrint(template, vars);
  return [
    `<!-- header-left:${escapeHtml(resolve(header.left ?? ""))} -->`,
    `<!-- header-center:${escapeHtml(resolve(header.center ?? ""))} -->`,
    `<!-- header-right:${escapeHtml(resolve(header.right ?? ""))} -->`,
    `<!-- footer-left:${escapeHtml(resolve(footer.left ?? ""))} -->`,
    `<!-- footer-center:${escapeHtml(resolve(footer.center ?? ""))} -->`,
    `<!-- footer-right:${escapeHtml(resolve(footer.right ?? ""))} -->`
  ].join("\n");
}

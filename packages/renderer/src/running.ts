import type { Mdoc } from "@mdword/layout-engine";
import { resolveRunningForPrint } from "@mdword/layout-engine";

type Running = { left?: string; center?: string; right?: string };

function cssContentValue(template: string): string | null {
  if (!template) return null;
  const parts = template.split(/(\{\{page\}\}|\{\{pages\}\})/g).filter((part) => part.length > 0);
  if (!parts.length) return null;
  return parts
    .map((part) => {
      if (part === "{{page}}") return "counter(page)";
      if (part === "{{pages}}") return "counter(pages)";
      return JSON.stringify(part);
    })
    .join(" ");
}

export function pageMarginCss(header: Running, footer: Running): string {
  const rules: string[] = [];
  const box = (name: string, template: string | undefined) => {
    const expr = cssContentValue(template ?? "");
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

export function runningBarsHtml(
  header: Running,
  footer: Running,
  vars: {
    title?: string;
    subtitle?: string;
    author?: string;
    date?: string;
    filename?: string;
  }
): { header: string; footer: string } {
  const resolve = (template: string) => resolveRunningForPrint(template, vars);
  const cell = (template: string) => {
    const html = escapeHtml(resolve(template))
      .replace(/\{\{page\}\}/g, '<span class="print-page"></span>')
      .replace(/\{\{pages\}\}/g, '<span class="print-pages"></span>');
    return `<span>${html}</span>`;
  };
  return {
    header: `<div class="print-running print-running-header">${cell(header.left ?? "")}${cell(header.center ?? "")}${cell(header.right ?? "")}</div>`,
    footer: `<div class="print-running print-running-footer">${cell(footer.left ?? "")}${cell(footer.center ?? "")}${cell(footer.right ?? "")}</div>`
  };
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function resolvedRunningComments(
  mdoc: Mdoc,
  vars: {
    title?: string;
    subtitle?: string;
    author?: string;
    date?: string;
    filename?: string;
  }
): string {
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

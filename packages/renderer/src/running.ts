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
  const escape = (text: string) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return [
    `<!-- header-left:${escape(resolve(header.left ?? ""))} -->`,
    `<!-- header-center:${escape(resolve(header.center ?? ""))} -->`,
    `<!-- header-right:${escape(resolve(header.right ?? ""))} -->`,
    `<!-- footer-left:${escape(resolve(footer.left ?? ""))} -->`,
    `<!-- footer-center:${escape(resolve(footer.center ?? ""))} -->`,
    `<!-- footer-right:${escape(resolve(footer.right ?? ""))} -->`
  ].join("\n");
}

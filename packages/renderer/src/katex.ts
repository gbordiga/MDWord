import katex from "katex";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderKatex(latex: string, displayMode = false): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: "ignore"
    });
  } catch {
    const safe = escapeHtml(latex);
    return displayMode ? `<pre>${safe}</pre>` : `<code>${safe}</code>`;
  }
}

/** Write KaTeX into a node without assigning a tainted HTML string. */
export function renderKatexInto(el: HTMLElement, latex: string, displayMode = false): boolean {
  try {
    katex.render(latex, el, {
      displayMode,
      throwOnError: true,
      strict: "ignore"
    });
    return true;
  } catch {
    return false;
  }
}

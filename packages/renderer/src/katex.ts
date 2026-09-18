import katex from "katex";

export function renderKatex(latex: string, displayMode = false): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: "ignore"
    });
  } catch {
    return displayMode ? `<pre>${latex}</pre>` : `<code>${latex}</code>`;
  }
}

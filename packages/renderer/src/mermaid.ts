type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, text: string) => Promise<{ svg: string }>;
};

let mermaidApi: MermaidApi | null = null;
let mermaidLoading: Promise<MermaidApi> | null = null;
let renderSerial = 0;

async function loadMermaid(): Promise<MermaidApi> {
  if (mermaidApi) return mermaidApi;
  if (!mermaidLoading) {
    mermaidLoading = import("mermaid")
      .then((mod) => {
        const mermaid = (mod as { default?: MermaidApi }).default ?? (mod as unknown as MermaidApi);
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
          fontFamily: "Aptos, Calibri, Carlito, Segoe UI, system-ui, sans-serif"
        });
        mermaidApi = mermaid;
        return mermaid;
      })
      .catch((error) => {
        mermaidLoading = null;
        throw error;
      });
  }
  return mermaidLoading;
}

export async function renderMermaidSvg(source: string): Promise<string> {
  const text = source.trim();
  if (!text) throw new Error("Empty Mermaid diagram");
  const mermaid = await loadMermaid();
  renderSerial += 1;
  const id = `mdword-mermaid-${renderSerial}`;
  const { svg } = await mermaid.render(id, text);
  return svg;
}

export async function hydrateMermaidHtml(html: string): Promise<string> {
  if (typeof DOMParser === "undefined") return html;
  if (!html.includes("md-mermaid")) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks = [...doc.querySelectorAll("figure.md-mermaid")];
  if (!blocks.length) return html;
  for (const block of blocks) {
    const pre = block.querySelector("pre");
    const source = pre?.textContent ?? "";
    if (!source.trim()) continue;
    try {
      block.innerHTML = await renderMermaidSvg(source);
      block.classList.add("md-mermaid-ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid Mermaid diagram";
      const err = doc.createElement("p");
      err.className = "md-mermaid-error";
      err.textContent = message;
      block.prepend(err);
    }
  }
  const doctype = /<!doctype/i.test(html) ? "<!DOCTYPE html>\n" : "";
  return `${doctype}${doc.documentElement.outerHTML}`;
}

export function mermaidFigureHtml(source: string): string {
  const escaped = source
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<figure class="md-mermaid"><pre class="mermaid">${escaped}</pre></figure>`;
}

import { parseWikiLinkInner } from "@mdword/shared";

const ALLOWED = new Set(["http:", "https:", "mailto:"]);

const WIKI_HREF = "#wiki:";

/** Turn `[[Page]]` / `[[Page#Section|label]]` into markdown links. Code spans stay literal. */
export function linkifyWikilinks(markdown: string): string {
  const slots: string[] = [];
  const mask = (block: string) => `\u0000${slots.push(block) - 1}\u0000`;
  let text = markdown.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, mask);
  text = text.replace(/`[^`\n]*`/g, mask);

  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text.startsWith("[[", i)) {
      const close = text.indexOf("]]", i + 2);
      if (close !== -1) {
        const raw = text.slice(i, close + 2);
        const parts = parseWikiLinkInner(raw);
        if (parts?.target) {
          const visible = parts.label ?? (parts.section ? `${parts.target} › ${parts.section}` : parts.target);
          const label = visible.replace(/[\[\]]/g, "\\$&");
          out += `[${label}](${WIKI_HREF}${encodeURIComponent(parts.target)})`;
          i += raw.length;
          continue;
        }
      }
    }
    out += text[i];
    i += 1;
  }

  return out.replace(/\u0000(\d+)\u0000/g, (_, n) => slots[Number(n)] ?? "");
}

export function wikiTargetFromHref(href: string | undefined): string | null {
  if (!href?.startsWith(WIKI_HREF)) return null;
  try {
    const target = decodeURIComponent(href.slice(WIKI_HREF.length)).trim();
    return target || null;
  } catch {
    return null;
  }
}

/** Only web and mail links from model output become clickable. */
export function safeHref(href: string | undefined): string | null {
  if (!href) return null;
  try {
    const url = new URL(href.trim());
    return ALLOWED.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

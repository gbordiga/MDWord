import type { Editor } from "@tiptap/react";
import { normalizeHref } from "@mdword/editor";
import { getHost } from "@/lib/host";
import { useApp } from "@/lib/store";

export function isModifiedClick(event: MouseEvent): boolean {
  return event.button === 0 && (event.ctrlKey || event.metaKey);
}

function openHref(href: string): boolean {
  const url = normalizeHref(href);
  if (!url) return false;
  if (/^https?:/i.test(url) || url.startsWith("mailto:")) {
    void getHost().shell.openExternal(url);
    return true;
  }
  return false;
}

function openWiki(target: string): boolean {
  const name = target.trim();
  if (!name) return false;
  void useApp.getState().openWorkspaceFileByTitle(name, { preview: true });
  return true;
}

type EditorView = Editor["view"];

function wikiAtPos(view: EditorView, pos: number): string | null {
  const node = view.state.doc.nodeAt(pos);
  if (node?.type.name === "wikiLink") {
    return String(node.attrs.target || node.attrs.label || "").trim() || null;
  }
  const $pos = view.state.doc.resolve(pos);
  if ($pos.parent.type.name === "wikiLink") {
    return String($pos.parent.attrs.target || $pos.parent.attrs.label || "").trim() || null;
  }
  return null;
}

function hrefAtPos(view: EditorView, pos: number): string | null {
  const marks = view.state.doc.resolve(pos).marks();
  const link = marks.find((mark) => mark.type.name === "link");
  const href = link?.attrs.href;
  return typeof href === "string" && href ? href : null;
}

function fromDom(event: MouseEvent): { wiki: string | null; href: string | null } {
  const target = event.target as HTMLElement | null;
  const wiki = target?.closest?.<HTMLElement>("[data-wiki-link], .md-wikilink");
  const anchor = target?.closest?.<HTMLAnchorElement>("a[href]");
  return {
    wiki: wiki ? (wiki.getAttribute("data-target") || wiki.textContent || "").trim() || null : null,
    href: anchor?.getAttribute("href") ?? null
  };
}

/** Wikilinks open on click; external links use Ctrl/Cmd+click. */
export function handleEditorLinkClick(view: EditorView, pos: number, event: MouseEvent): boolean {
  const dom = fromDom(event);
  const wikiTarget = dom.wiki || wikiAtPos(view, pos);
  if (wikiTarget && openWiki(wikiTarget)) {
    event.preventDefault();
    return true;
  }
  if (!isModifiedClick(event)) return false;
  if (dom.href && openHref(dom.href)) {
    event.preventDefault();
    return true;
  }
  const href = hrefAtPos(view, pos);
  if (href && openHref(href)) {
    event.preventDefault();
    return true;
  }
  return false;
}

export function preventBrowserLinkOpen(event: MouseEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (target?.closest?.("[data-wiki-link], .md-wikilink")) {
    event.preventDefault();
    return false;
  }
  if (!isModifiedClick(event)) return false;
  if (target?.closest?.("a[href]")) {
    event.preventDefault();
  }
  return false;
}

import type { Editor } from "@tiptap/react";
import { normalizeHref } from "@mdword/editor";
import { resolveExternalImagePath } from "@mdword/shared";
import { getHost } from "@/lib/host";
import { useApp } from "@/lib/store";

const EDITABLE_FILE = /\.(md|markdown|mdown|mkd|txt)$/i;

export function isModifiedClick(event: MouseEvent): boolean {
  return event.button === 0 && (event.ctrlKey || event.metaKey);
}

function alertLink(message: string): void {
  window.alert(message);
}

export function openWikiTarget(target: string): void {
  const name = target.trim();
  if (!name) {
    alertLink("Could not open this link.");
    return;
  }
  const state = useApp.getState();
  if (!state.workspace) {
    alertLink("Open a folder to follow this link.");
    return;
  }
  void state.openWorkspaceFileByTitle(name, { preview: true }).then((ok) => {
    if (!ok) alertLink(`Could not find “${name}”.`);
  });
}

export function openEditorHref(href: string): void {
  const url = normalizeHref(href);
  if (!url) {
    alertLink("Could not open this link.");
    return;
  }
  if (/^https?:/i.test(url) || url.startsWith("mailto:")) {
    void getHost()
      .shell.openExternal(url)
      .catch(() => alertLink("Could not open this link."));
    return;
  }
  if (url.startsWith("#")) {
    alertLink("Could not open this link.");
    return;
  }
  void openRelativeDocument(url);
}

async function openRelativeDocument(href: string): Promise<void> {
  const state = useApp.getState();
  if (!state.workspace) {
    alertLink("Open a folder to follow this link.");
    return;
  }
  const resolved = resolveExternalImagePath(href, state.path, state.workspace.root);
  const label = href.trim();
  if (!resolved) {
    alertLink(`Could not find “${label}”.`);
    return;
  }
  const hasExtension = /\.[a-z0-9]+$/i.test(resolved);
  if (hasExtension && !EDITABLE_FILE.test(resolved)) {
    alertLink(`Could not open “${label}” in the editor.`);
    return;
  }
  try {
    const exists = await getHost().files.exists(resolved);
    if (!exists) {
      alertLink(`Could not find “${label}”.`);
      return;
    }
    await useApp.getState().openWorkspaceFile(resolved, { preview: true });
  } catch {
    alertLink(`Could not find “${label}”.`);
  }
}

type EditorView = Editor["view"];

function wikiAtPos(view: EditorView, pos: number): string | null {
  const $pos = view.state.doc.resolve(Math.max(0, Math.min(pos, view.state.doc.content.size)));
  const before = pos > 0 ? view.state.doc.resolve(pos - 1).marks() : [];
  const wiki = [...$pos.marks(), ...before].find((mark) => mark.type.name === "wikiLink");
  if (!wiki) return null;
  return String(wiki.attrs.target || "").trim() || null;
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

/** Ctrl/Cmd+click opens wikilinks and links. A plain click leaves the caret in the text so the bubble can show. */
export function handleEditorLinkClick(view: EditorView, pos: number, event: MouseEvent): boolean {
  const dom = fromDom(event);
  const wikiTarget = dom.wiki || wikiAtPos(view, pos);
  if (wikiTarget) {
    if (!isModifiedClick(event)) return false;
    event.preventDefault();
    openWikiTarget(wikiTarget);
    return true;
  }
  if (!isModifiedClick(event)) return false;
  const href = dom.href || hrefAtPos(view, pos);
  if (!href) return false;
  event.preventDefault();
  openEditorHref(href);
  return true;
}

export function preventBrowserLinkOpen(event: MouseEvent): boolean {
  if (!isModifiedClick(event)) return false;
  const target = event.target as HTMLElement | null;
  if (target?.closest?.("[data-wiki-link], .md-wikilink, a[href]")) {
    event.preventDefault();
    return true;
  }
  return false;
}

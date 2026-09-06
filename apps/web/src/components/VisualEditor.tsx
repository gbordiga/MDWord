"use client";

import { Component, useEffect, useRef, useState, type CSSProperties, type ErrorInfo, type ReactNode } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { editorExtensions, astToTiptap, type TiptapNode } from "@mdword/editor";
import { pageMetrics, resolveVariables } from "@mdword/layout-engine";
import { documentTitle } from "@mdword/shared";
import { useApp } from "@/lib/store";
import { getHost } from "@/lib/host";

function tiptapContentFromAst(ast: Parameters<typeof astToTiptap>[0]): TiptapNode {
  try {
    return astToTiptap(ast);
  } catch {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
}

class VisualEditorBoundary extends Component<
  { resetKey: number; onOpenSource: () => void; children: ReactNode },
  { error: Error | null }
> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Visual editor failed to render", error, info.componentStack);
  }

  override componentDidUpdate(prevProps: { resetKey: number }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  override render() {
    if (this.state.error) {
      return (
        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 bg-[#d8dee6] px-6 text-center"
          data-testid="visual-editor-error"
        >
          <p className="text-[15px] font-medium text-[#1c1f24]">This document could not be shown in visual mode.</p>
          <p className="max-w-md text-[13px] text-[#667085]">{this.state.error.message}</p>
          <button
            type="button"
            className="rounded-md bg-[#2f6fed] px-3 py-2 text-[13px] text-white"
            onClick={this.props.onOpenSource}
          >
            Open as source
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function useFitScale(widthPx: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const styles = window.getComputedStyle(el);
      const pad =
        (Number.parseFloat(styles.paddingLeft) || 0) + (Number.parseFloat(styles.paddingRight) || 0);
      const available = Math.max(120, el.clientWidth - pad);
      setFit(Math.min(1, available / widthPx));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [widthPx]);

  return { ref, fit };
}

export function VisualEditor({
  editorRef,
  onEditor
}: {
  editorRef: { current: Editor | null };
  onEditor?: (editor: Editor | null) => void;
}) {
  const syncGeneration = useApp((s) => s.syncGeneration);
  return (
    <VisualEditorBoundary
      resetKey={syncGeneration}
      onOpenSource={() => useApp.getState().setView("source")}
    >
      <VisualEditorCanvas editorRef={editorRef} onEditor={onEditor} />
    </VisualEditorBoundary>
  );
}

function VisualEditorCanvas({
  editorRef,
  onEditor
}: {
  editorRef: { current: Editor | null };
  onEditor?: (editor: Editor | null) => void;
}) {
  const model = useApp((s) => s.model);
  const zoom = useApp((s) => s.zoom);
  const applyTiptap = useApp((s) => s.applyTiptap);
  const syncGeneration = useApp((s) => s.syncGeneration);

  const editor = useEditor({
    extensions: editorExtensions(),
    content: tiptapContentFromAst(model.ast),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "md-prose",
        spellcheck: "true"
      }
    },
    onUpdate: ({ editor: ed }) => {
      applyTiptap(ed.getJSON() as never);
    }
  });

  editorRef.current = editor;
  useEffect(() => {
    onEditor?.(editor ?? null);
    return () => {
      onEditor?.(null);
      editorRef.current = null;
    };
  }, [editor, onEditor]);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const wiki = target.closest<HTMLElement>(".md-wikilink, [data-wiki-link]");
      if (wiki) {
        event.preventDefault();
        const name = (wiki.getAttribute("data-target") || wiki.textContent || "").trim();
        if (name) void useApp.getState().openWorkspaceFileByTitle(name);
        return;
      }
      const anchor = target.closest<HTMLAnchorElement>("a.md-link, a[href]");
      if (anchor && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        const href = anchor.getAttribute("href");
        if (href) void getHost().shell.openExternal(href);
      }
    };
    dom.addEventListener("click", onClick);
    return () => dom.removeEventListener("click", onClick);
  }, [editor]);

  const lastGen = useRef(syncGeneration);
  useEffect(() => {
    if (!editor) return;
    if (lastGen.current === syncGeneration) return;
    lastGen.current = syncGeneration;
    try {
      editor.commands.setContent(tiptapContentFromAst(model.ast));
    } catch (error) {
      console.error("Visual editor could not load document content", error);
      editor.commands.setContent({ type: "doc", content: [{ type: "paragraph" }] });
    }
  }, [editor, syncGeneration, model.ast]);

  const metrics = pageMetrics(model.resolvedMdoc);
  const { ref, fit } = useFitScale(metrics.widthPx);
  const scale = fit * zoom;
  const pageMinHeight = metrics.heightPx * 1.15;
  const body = model.resolvedMdoc.typography?.body;
  const header = model.resolvedMdoc.header ?? {};
  const footer = model.resolvedMdoc.footer ?? {};
  const vars = {
    title: documentTitle(model.frontmatter, ""),
    subtitle: String(model.frontmatter.subtitle ?? model.frontmatter.sottotitolo ?? ""),
    author: Array.isArray(model.frontmatter.authors)
      ? String((model.frontmatter.authors as { name?: string }[])[0]?.name ?? "")
      : String(model.frontmatter.author ?? ""),
    date: String(model.frontmatter.date ?? ""),
    filename: "",
    page: 1,
    pages: 1
  };

  const pages = 3;
  const typo = model.resolvedMdoc.typography ?? {};
  const titleText = documentTitle(model.frontmatter, "");
  const subtitleText = String(model.frontmatter.subtitle ?? model.frontmatter.sottotitolo ?? "");

  return (
    <div
      ref={ref}
      data-testid="page-scroll"
      className="page-scroll min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain bg-[#d8dee6] px-2 py-3 lg:px-4 lg:py-8"
    >
      <div
        className="page-frame mx-auto"
        data-testid="page-canvas"
        style={
          {
            "--page-w": `${metrics.widthPx}px`,
            "--page-min-h": `${pageMinHeight}px`,
            "--page-scale": String(scale),
            "--user-zoom": String(zoom),
            "--md-h1-size": String(typo["heading-1"]?.["font-size"] ?? "20pt"),
            "--md-h1-weight": String(typo["heading-1"]?.weight ?? 700),
            "--md-h2-size": String(typo["heading-2"]?.["font-size"] ?? "16pt"),
            "--md-h2-weight": String(typo["heading-2"]?.weight ?? 650),
            "--md-h3-size": String(typo["heading-3"]?.["font-size"] ?? "14pt"),
            "--md-h3-weight": String(typo["heading-3"]?.weight ?? 650),
            "--md-h4-size": String(typo["heading-4"]?.["font-size"] ?? "12pt"),
            width: metrics.widthPx * scale,
            minHeight: pageMinHeight * scale
          } as CSSProperties
        }
      >
        <div
          className="page-inner relative bg-white shadow-page"
          style={{
            width: metrics.widthPx,
            minHeight: pageMinHeight,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            fontFamily: String(body?.["font-family"] ?? "Aptos, Calibri, Carlito, Segoe UI, sans-serif"),
            fontSize: String(body?.["font-size"] ?? "11pt"),
            lineHeight: String(body?.["line-height"] ?? 1.15)
          }}
        >
          <div
            className="relative"
            style={{
              paddingTop: metrics.margins.top + 22,
              paddingRight: metrics.margins.right,
              paddingBottom: metrics.margins.bottom + 22,
              paddingLeft: metrics.margins.left
            }}
          >
            {titleText ? (
              <div className="md-doc-masthead">
                <div className="md-doc-title" data-testid="doc-title">
                  {titleText}
                </div>
                {subtitleText ? <p className="md-doc-subtitle">{subtitleText}</p> : null}
              </div>
            ) : null}
            <EditorContent editor={editor} />
          </div>
          <div className="page-overlay pointer-events-none" aria-hidden>
            {Array.from({ length: pages }).map((_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 border-b border-[#d0d5dd]"
                style={{ top: (i + 1) * metrics.heightPx, height: 0 }}
              />
            ))}
            <div
              className="absolute left-0 right-0 top-0 flex justify-between px-8 text-[10px] text-[#667085]"
              style={{ height: metrics.margins.top, alignItems: "center" }}
            >
              <span>{resolveVariables(header.left ?? "", vars)}</span>
              <span>{resolveVariables(header.center ?? "", vars)}</span>
              <span>
                {resolveVariables(header.right ?? "", { ...vars, page: "1", pages: "1" }).replace(
                  "1 / 1",
                  "1 / …"
                )}
              </span>
            </div>
            <div
              className="absolute left-0 right-0 bottom-0 flex justify-between px-8 text-[10px] text-[#667085]"
              style={{ height: metrics.margins.bottom, alignItems: "center" }}
            >
              <span>{resolveVariables(footer.left ?? "", vars)}</span>
              <span>{resolveVariables(footer.center ?? "", vars)}</span>
              <span>{resolveVariables(footer.right ?? "", vars)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

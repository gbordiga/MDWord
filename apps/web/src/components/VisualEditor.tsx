"use client";

import {
  Component,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ErrorInfo,
  type ReactNode
} from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { editorExtensions, astToTiptap, type PageGapsStorage, type TiptapNode } from "@mdword/editor";
import {
  countFlowPages,
  PAGE_STACK_GAP_PX,
  pageMetrics,
  pageStackHeightPx,
  resolveRunningForPreview
} from "@mdword/layout-engine";
import { documentDate, documentTitle } from "@mdword/shared";
import { useApp } from "@/lib/store";
import { Spinner } from "./Spinner";
import { DocumentToc } from "./DocumentToc";
import { PageRulers } from "./PageRulers";
import { FrontmatterInline } from "./FrontmatterInline";
import { collectEditorHeadings, jumpToHeading } from "@/lib/toc";
import { handleEditorLinkClick, preventBrowserLinkOpen } from "@/lib/openEditorLink";
import { useEditorTick } from "@/hooks/useEditorTick";
import { useIsCompact } from "@/hooks/useMediaQuery";

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

function useFitScale(widthPx: number, elRef: { current: HTMLElement | null }) {
  const [fit, setFit] = useState(1);

  useEffect(() => {
    const el = elRef.current;
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
  }, [widthPx, elRef]);

  return fit;
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
  const patchMdoc = useApp((s) => s.patchMdoc);
  const zoom = useApp((s) => s.zoom);
  const pageLayout = useApp((s) => s.pageLayout);
  const compact = useIsCompact();
  const paged = pageLayout === "pages" && !compact;
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
      },
      handleClick: (view, pos, event) =>
        event.defaultPrevented ? true : handleEditorLinkClick(view, pos, event),
      handleDOMEvents: {
        mousedown: (_view, event) => preventBrowserLinkOpen(event)
      }
    },
    onUpdate: ({ editor: ed }) => {
      applyTiptap(ed.getJSON() as never);
    }
  });
  useEditorTick(editor);

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
      const wiki = (event.target as HTMLElement | null)?.closest?.("a[href], [data-wiki-link]");
      if (!wiki) return;
      const pos = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
      if (pos && handleEditorLinkClick(editor.view, pos.pos, event)) {
        event.stopPropagation();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Control" && event.key !== "Meta") return;
      dom.classList.toggle("md-mod-link", event.type === "keydown");
    };
    const clearMod = () => dom.classList.remove("md-mod-link");
    dom.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", clearMod);
    return () => {
      dom.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", clearMod);
    };
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
    } finally {
      useApp.getState().finishBusy(["open", "workspace"]);
    }
  }, [editor, syncGeneration, model.ast]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(1);
  const metrics = pageMetrics(model.resolvedMdoc);
  const fit = useFitScale(metrics.widthPx, scrollRef);
  const scale = fit * zoom;
  const padTop = metrics.margins.top + 22;
  const padBottom = metrics.margins.bottom + 22;
  const usableH = Math.max(48, metrics.heightPx - padTop - padBottom);
  const spacerH = padTop + padBottom + PAGE_STACK_GAP_PX;
  const pageMinHeight = paged ? metrics.heightPx : metrics.heightPx * 1.15;
  const sheetCount = paged ? pageCount : 1;
  const body = model.resolvedMdoc.typography?.body;
  const header = model.resolvedMdoc.header ?? {};
  const footer = model.resolvedMdoc.footer ?? {};
  const vars = {
    title: documentTitle(model.frontmatter, ""),
    subtitle: String(model.frontmatter.subtitle ?? model.frontmatter.sottotitolo ?? ""),
    author: Array.isArray(model.frontmatter.authors)
      ? String((model.frontmatter.authors as { name?: string }[])[0]?.name ?? "")
      : String(model.frontmatter.author ?? ""),
    date: documentDate(model.frontmatter),
    filename: "",
    page: 1
  };
  const tocEnabled = Boolean(model.resolvedMdoc.toc?.enabled);
  const tocDepth = model.resolvedMdoc.toc?.depth ?? 3;
  const numberedHeadings = Boolean(model.resolvedMdoc.numbering?.headings);
  const tocItems = editor ? collectEditorHeadings(editor, tocDepth) : [];

  const typo = model.resolvedMdoc.typography ?? {};
  const titleText = documentTitle(model.frontmatter, "");
  const subtitleText = String(model.frontmatter.subtitle ?? model.frontmatter.sottotitolo ?? "");
  const dateText = documentDate(model.frontmatter);

  useLayoutEffect(() => {
    if (!editor) return;
    const storage = editor.storage.pageGaps as PageGapsStorage;
    storage.enabled = paged;
    storage.usableHeight = usableH;
    storage.spacerHeight = spacerH;
    const prose = editor.view.dom;
    const padded = contentRef.current;
    storage.contentTop = padded ? Math.max(0, prose.offsetTop) : 0;
    editor.view.dispatch(editor.state.tr.setMeta("pageGapsRefresh", true).setMeta("addToHistory", false));

    const measure = () => {
      if (!paged || !padded) {
        setPageCount(1);
        return;
      }
      let gapH = 0;
      padded.querySelectorAll<HTMLElement>(".md-page-gap").forEach((node) => {
        gapH += node.offsetHeight;
      });
      const inner = Math.max(0, padded.scrollHeight - padTop - padBottom - gapH);
      setPageCount(countFlowPages(inner, usableH));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(padded ?? prose);
    return () => ro.disconnect();
  }, [editor, paged, usableH, spacerH, padTop, padBottom, titleText, subtitleText, tocEnabled, tocItems.length]);

  const runningVars = (index: number) => ({ ...vars, page: index + 1, pages: sheetCount });

  return (
    <div className="relative min-h-0 min-w-0 flex-1 bg-[#d8dee6]">
      <PageRulers
        scrollRef={scrollRef}
        pageRef={pageRef}
        metrics={metrics}
        scale={scale}
        pageHeightPx={metrics.heightPx}
        onChange={(margins) => patchMdoc({ ...model.mdoc, margins })}
      />
      <div
        ref={scrollRef}
        data-testid="page-scroll"
        className="page-scroll absolute inset-0 overflow-auto overscroll-contain px-2 py-3 lg:pb-8 lg:pr-4 lg:pl-[38px] lg:pt-[46px]"
      >
      <FrontmatterInline width={metrics.widthPx * scale} />
      <div
        ref={pageRef}
        className="page-frame mx-auto"
        data-testid="page-canvas"
        style={
          {
            "--page-w": `${metrics.widthPx}px`,
            "--page-min-h": `${pageMinHeight}px`,
            "--page-scale": String(scale),
            "--user-zoom": String(zoom),
            "--md-title-size": String(typo.title?.["font-size"] ?? "28pt"),
            "--md-title-weight": String(typo.title?.weight ?? 700),
            "--md-subtitle-size": String(typo.subtitle?.["font-size"] ?? "14pt"),
            "--md-h1-size": String(typo["heading-1"]?.["font-size"] ?? "20pt"),
            "--md-h1-weight": String(typo["heading-1"]?.weight ?? 700),
            "--md-h2-size": String(typo["heading-2"]?.["font-size"] ?? "16pt"),
            "--md-h2-weight": String(typo["heading-2"]?.weight ?? 650),
            "--md-h3-size": String(typo["heading-3"]?.["font-size"] ?? "14pt"),
            "--md-h3-weight": String(typo["heading-3"]?.weight ?? 650),
            "--md-h4-size": String(typo["heading-4"]?.["font-size"] ?? "12pt"),
            width: metrics.widthPx * scale,
            minHeight: (paged ? pageStackHeightPx(sheetCount, metrics.heightPx) : pageMinHeight) * scale,
            height: paged ? pageStackHeightPx(sheetCount, metrics.heightPx) * scale : undefined
          } as CSSProperties
        }
      >
        <div
          ref={paged ? undefined : pageRef}
          className={`page-inner relative ${paged ? "" : "bg-white shadow-page"}`}
          style={{
            width: metrics.widthPx,
            minHeight: paged ? pageStackHeightPx(sheetCount, metrics.heightPx) : pageMinHeight,
            height: paged ? pageStackHeightPx(sheetCount, metrics.heightPx) : undefined,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            fontFamily: String(body?.["font-family"] ?? "Aptos, Calibri, Carlito, Segoe UI, sans-serif"),
            fontSize: String(body?.["font-size"] ?? "11pt"),
            lineHeight: String(body?.["line-height"] ?? 1.15)
          }}
        >
          {paged
            ? Array.from({ length: sheetCount }, (_, index) => {
                const pageVars = runningVars(index);
                return (
                  <div
                    key={index}
                    ref={index === 0 ? pageRef : undefined}
                    className="absolute left-0 bg-white shadow-page"
                    data-testid={index === 0 ? "page-sheet" : undefined}
                    style={{
                      top: index * (metrics.heightPx + PAGE_STACK_GAP_PX),
                      width: metrics.widthPx,
                      height: metrics.heightPx
                    }}
                  >
                    <div
                      className="page-overlay pointer-events-none"
                      aria-hidden={index > 0}
                      data-testid={index === 0 ? "page-overlay" : undefined}
                    >
                      <div
                        className="absolute left-0 right-0 top-0 flex justify-between px-8 text-[10px] text-[#667085]"
                        style={{ height: metrics.margins.top, alignItems: "center" }}
                        data-testid={index === 0 ? "page-header" : undefined}
                      >
                        <span data-testid={index === 0 ? "page-header-left" : undefined}>
                          {resolveRunningForPreview(header.left ?? "", pageVars)}
                        </span>
                        <span data-testid={index === 0 ? "page-header-center" : undefined}>
                          {resolveRunningForPreview(header.center ?? "", pageVars)}
                        </span>
                        <span data-testid={index === 0 ? "page-header-right" : undefined}>
                          {resolveRunningForPreview(header.right ?? "", pageVars)}
                        </span>
                      </div>
                      <div
                        className="absolute left-0 right-0 bottom-0 flex justify-between px-8 text-[10px] text-[#667085]"
                        style={{ height: metrics.margins.bottom, alignItems: "center" }}
                        data-testid={index === 0 ? "page-footer" : undefined}
                      >
                        <span data-testid={index === 0 ? "page-footer-left" : undefined}>
                          {resolveRunningForPreview(footer.left ?? "", pageVars)}
                        </span>
                        <span data-testid={index === 0 ? "page-footer-center" : undefined}>
                          {resolveRunningForPreview(footer.center ?? "", pageVars)}
                        </span>
                        <span data-testid={index === 0 ? "page-footer-right" : undefined}>
                          {resolveRunningForPreview(footer.right ?? "", pageVars)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            : (
              <div className="page-overlay pointer-events-none" aria-hidden data-testid="page-overlay">
                <div
                  className="absolute left-0 right-0 top-0 flex justify-between px-8 text-[10px] text-[#667085]"
                  style={{ height: metrics.margins.top, alignItems: "center" }}
                  data-testid="page-header"
                >
                  <span data-testid="page-header-left">{resolveRunningForPreview(header.left ?? "", vars)}</span>
                  <span data-testid="page-header-center">{resolveRunningForPreview(header.center ?? "", vars)}</span>
                  <span data-testid="page-header-right">{resolveRunningForPreview(header.right ?? "", vars)}</span>
                </div>
                <div
                  className="absolute left-0 right-0 bottom-0 flex justify-between px-8 text-[10px] text-[#667085]"
                  style={{ height: metrics.margins.bottom, alignItems: "center" }}
                  data-testid="page-footer"
                >
                  <span data-testid="page-footer-left">{resolveRunningForPreview(footer.left ?? "", vars)}</span>
                  <span data-testid="page-footer-center">{resolveRunningForPreview(footer.center ?? "", vars)}</span>
                  <span data-testid="page-footer-right">{resolveRunningForPreview(footer.right ?? "", vars)}</span>
                </div>
              </div>
            )}
          <div
            ref={contentRef}
            className="relative z-10"
            style={{
              paddingTop: padTop,
              paddingRight: metrics.margins.right,
              paddingBottom: padBottom,
              paddingLeft: metrics.margins.left
            }}
          >
            {titleText || subtitleText || dateText ? (
              <div className="md-doc-masthead">
                {titleText ? (
                  <div className="md-doc-title" data-testid="doc-title">
                    {titleText}
                  </div>
                ) : null}
                {subtitleText ? <p className="md-doc-subtitle">{subtitleText}</p> : null}
                {dateText ? (
                  <p className="md-doc-date" data-testid="doc-date">
                    {dateText}
                  </p>
                ) : null}
              </div>
            ) : null}
            {tocEnabled ? (
              <DocumentToc
                items={tocItems}
                numbered={numberedHeadings}
                onJump={(index) => editor && jumpToHeading(editor, index, tocDepth)}
              />
            ) : null}
            <EditorContent editor={editor} className={numberedHeadings ? "md-numbered-headings" : undefined} />
          </div>
        </div>
      </div>
      {!editor ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-[#d8dee6]/75"
          data-testid="editor-loading"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-3 rounded-xl bg-white px-6 py-5 shadow-page">
            <Spinner size={28} />
            <p className="text-[13px] font-medium text-[#344054]">Loading document…</p>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}

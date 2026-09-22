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
import {
  editorExtensions,
  astToTiptap,
  replaceEditorDocument,
  focusEditorAtPagePoint,
  isBlankPageClickTarget,
  selectAtPointer,
  type TiptapNode
} from "@mdword/editor";
import { pageMetrics, resolveRunningForPreview } from "@mdword/layout-engine";
import { documentDate, documentTitle } from "@mdword/shared";
import { useApp } from "@/lib/store";
import { Spinner } from "./Spinner";
import { DocumentToc } from "./DocumentToc";
import { PageRulers, RULER } from "./PageRulers";
import { FrontmatterInline } from "./FrontmatterInline";
import { collectEditorHeadings, jumpToHeading } from "@/lib/toc";
import { handleEditorLinkClick, preventBrowserLinkOpen } from "@/lib/openEditorLink";
import { useEditorTick } from "@/hooks/useEditorTick";
import { useEditorUi } from "@/lib/editorUi";

function tiptapContentFromAst(ast: Parameters<typeof astToTiptap>[0]): TiptapNode {
  try {
    return astToTiptap(ast);
  } catch {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
}

function VisualEditorFallback({ error, onOpenSource }: { error?: Error | null; onOpenSource: () => void }) {
  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 bg-[#d8dee6] px-6 text-center"
      data-testid="visual-editor-error"
    >
      <p className="text-[15px] font-medium text-[#1c1f24]">This document could not be shown in visual mode.</p>
      {error?.message ? <p className="max-w-md text-[13px] text-[#667085]">{error.message}</p> : null}
      <button
        type="button"
        className="rounded-md bg-[#2f6fed] px-3 py-2 text-[13px] text-white"
        onClick={onOpenSource}
      >
        Open as source
      </button>
    </div>
  );
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
      return <VisualEditorFallback error={this.state.error} onOpenSource={this.props.onOpenSource} />;
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
  const frontmatter = useApp((s) => s.model.frontmatter);
  const mdoc = useApp((s) => s.model.mdoc);
  const resolvedMdoc = useApp((s) => s.model.resolvedMdoc);
  const patchMdoc = useApp((s) => s.patchMdoc);
  const zoom = useApp((s) => s.zoom);
  const applyTiptap = useApp((s) => s.applyTiptap);
  const activeTabId = useApp((s) => s.activeTabId);
  const syncGeneration = useApp((s) => s.syncGeneration);
  const sourceGeneration = useApp((s) => s.sourceGeneration);
  const skipProgrammaticUpdate = useRef(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const { openContextMenu } = useEditorUi();
  const openSource = () => useApp.getState().setView("source");

  const editor = useEditor({
    extensions: editorExtensions(),
    content: tiptapContentFromAst(useApp.getState().model.ast),
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: "md-prose",
        spellcheck: "false",
        autocorrect: "off",
        autocomplete: "off",
        autocapitalize: "off"
      },
      handleClick: (view, pos, event) =>
        event.defaultPrevented ? true : handleEditorLinkClick(view, pos, event),
      handleDOMEvents: {
        mousedown: (_view, event) => preventBrowserLinkOpen(event),
        contextmenu: (view, event) => {
          event.preventDefault();
          selectAtPointer(view, event.clientX, event.clientY);
          openContextMenu(event.clientX, event.clientY);
          return true;
        }
      }
    },
    onUpdate: ({ editor: ed, transaction }) => {
      if (skipProgrammaticUpdate.current) return;
      if (transaction && !transaction.docChanged) return;
      applyTiptap(ed.getJSON() as never);
    }
  });
  useEditorTick(editor);

  useEffect(() => {
    if (!editor) return;
    const id = requestAnimationFrame(() => {
      skipProgrammaticUpdate.current = false;
    });
    return () => cancelAnimationFrame(id);
  }, [editor]);

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

  const lastSync = useRef({ tabId: "", sync: syncGeneration, source: sourceGeneration });
  useLayoutEffect(() => {
    skipProgrammaticUpdate.current = true;
  }, [activeTabId, syncGeneration, sourceGeneration]);
  useEffect(() => {
    if (!editor) return;
    const same =
      lastSync.current.tabId === activeTabId &&
      lastSync.current.sync === syncGeneration &&
      lastSync.current.source === sourceGeneration;
    if (same) return;
    lastSync.current = { tabId: activeTabId, sync: syncGeneration, source: sourceGeneration };
    skipProgrammaticUpdate.current = true;
    try {
      replaceEditorDocument(editor, astToTiptap(useApp.getState().model.ast));
      setLoadError(null);
    } catch (error) {
      console.error("Visual editor could not load document content", error);
      setLoadError(error instanceof Error ? error : new Error("This document could not be shown in visual mode."));
    } finally {
      requestAnimationFrame(() => {
        skipProgrammaticUpdate.current = false;
      });
      useApp.getState().finishBusy(["open", "workspace"]);
    }
  }, [editor, activeTabId, syncGeneration, sourceGeneration]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [canvasHeightPx, setCanvasHeightPx] = useState(0);
  const [rulerBox, setRulerBox] = useState({ x: RULER, y: RULER, w: 0, h: 0 });
  const metrics = pageMetrics(resolvedMdoc);
  const fit = useFitScale(metrics.widthPx, scrollRef);
  const scale = fit * zoom;
  const padTop = metrics.margins.top;
  const padBottom = metrics.margins.bottom;
  const pageMinHeight = metrics.heightPx;
  const canvasHeight = Math.max(pageMinHeight, canvasHeightPx);
  const body = resolvedMdoc.typography?.body;
  const header = resolvedMdoc.header ?? {};
  const footer = resolvedMdoc.footer ?? {};
  const vars = {
    title: documentTitle(frontmatter, ""),
    subtitle: String(frontmatter.subtitle ?? frontmatter.sottotitolo ?? ""),
    author: Array.isArray(frontmatter.authors)
      ? String((frontmatter.authors as { name?: string }[])[0]?.name ?? "")
      : String(frontmatter.author ?? ""),
    date: documentDate(frontmatter),
    filename: "",
    page: 1
  };
  const tocEnabled = Boolean(resolvedMdoc.toc?.enabled);
  const tocDepth = resolvedMdoc.toc?.depth ?? 3;
  const numberedHeadings = Boolean(resolvedMdoc.numbering?.headings);
  const tocItems = editor ? collectEditorHeadings(editor, tocDepth) : [];

  const typo = resolvedMdoc.typography ?? {};
  const titleText = documentTitle(frontmatter, "");
  const subtitleText = String(frontmatter.subtitle ?? frontmatter.sottotitolo ?? "");
  const dateText = documentDate(frontmatter);

  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const measure = () => setCanvasHeightPx(inner.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [editor, padTop, padBottom, titleText, subtitleText, tocEnabled, tocItems.length]);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    const page = pageRef.current;
    if (!scroll || !page) return;
    const update = () => {
      const sr = scroll.getBoundingClientRect();
      const pr = page.getBoundingClientRect();
      setRulerBox({
        x: pr.left - sr.left,
        y: pr.top - sr.top,
        w: pr.width,
        h: pr.height
      });
    };
    update();
    const rafUpdate = () => requestAnimationFrame(update);
    scroll.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", rafUpdate);
    const ro = new ResizeObserver(rafUpdate);
    ro.observe(scroll);
    ro.observe(page);
    const layout = layoutRef.current;
    if (layout) ro.observe(layout);
    return () => {
      scroll.removeEventListener("scroll", update);
      window.removeEventListener("resize", rafUpdate);
      ro.disconnect();
    };
  }, [scale, canvasHeight, metrics.widthPx, metrics.heightPx, padTop, padBottom]);

  if (loadError) {
    return <VisualEditorFallback error={loadError} onOpenSource={openSource} />;
  }

  return (
    <div className="relative min-h-0 min-w-0 flex-1 bg-[#d8dee6]">
      <PageRulers
        box={rulerBox}
        metrics={metrics}
        scale={scale}
        onChange={(margins) => patchMdoc({ ...mdoc, margins })}
      />
      <div
        ref={scrollRef}
        data-testid="page-scroll"
        className="page-scroll absolute inset-0 overflow-auto overscroll-contain px-2 py-3 lg:pb-8 lg:pr-4 lg:pl-[38px] lg:pt-[46px]"
      >
      <div ref={layoutRef}>
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
            minHeight: canvasHeight * scale,
            height: canvasHeight * scale
          } as CSSProperties
        }
      >
        <div
          ref={innerRef}
          className="page-inner relative bg-white shadow-page"
          onMouseDown={(event) => {
            if (!editor || event.button !== 0) return;
            if (!isBlankPageClickTarget(event.target)) return;
            event.preventDefault();
            focusEditorAtPagePoint(editor.view, event.clientX, event.clientY);
          }}
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
          <div
            ref={contentRef}
            className="relative z-10 flex w-full flex-1 flex-col"
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
            <EditorContent
              editor={editor}
              className={numberedHeadings ? "md-editor-fill md-numbered-headings" : "md-editor-fill"}
            />
          </div>
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

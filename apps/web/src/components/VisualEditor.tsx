"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { editorExtensions, astToTiptap } from "@mdword/editor";
import { pageMetrics, resolveVariables } from "@mdword/layout-engine";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useApp } from "@/lib/store";

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
  const model = useApp((s) => s.model);
  const zoom = useApp((s) => s.zoom);
  const applyTiptap = useApp((s) => s.applyTiptap);
  const syncGeneration = useApp((s) => s.syncGeneration);

  const editor = useEditor({
    extensions: editorExtensions(),
    content: astToTiptap(model.ast),
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

  const lastGen = useRef(syncGeneration);
  useEffect(() => {
    if (!editor) return;
    if (lastGen.current === syncGeneration) return;
    lastGen.current = syncGeneration;
    editor.commands.setContent(astToTiptap(model.ast));
  }, [editor, syncGeneration, model.ast]);

  const metrics = pageMetrics(model.resolvedMdoc);
  const { ref, fit } = useFitScale(metrics.widthPx);
  const scale = fit * zoom;
  const pageMinHeight = metrics.heightPx * 1.15;
  const body = model.resolvedMdoc.typography?.body;
  const header = model.resolvedMdoc.header ?? {};
  const footer = model.resolvedMdoc.footer ?? {};
  const vars = {
    title: String(model.frontmatter.title ?? ""),
    subtitle: String(model.frontmatter.subtitle ?? ""),
    author: Array.isArray(model.frontmatter.authors)
      ? String((model.frontmatter.authors as { name?: string }[])[0]?.name ?? "")
      : String(model.frontmatter.author ?? ""),
    date: String(model.frontmatter.date ?? ""),
    filename: "",
    page: 1,
    pages: 1
  };

  const pages = 3;

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

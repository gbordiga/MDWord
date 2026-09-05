"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { editorExtensions, astToTiptap } from "@mdword/editor";
import { pageMetrics } from "@mdword/layout-engine";
import { resolveVariables } from "@mdword/layout-engine";
import { useEffect, useRef } from "react";
import { useApp } from "@/lib/store";

export function VisualEditor({ editorRef }: { editorRef: { current: Editor | null } }) {
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

  const lastGen = useRef(syncGeneration);
  useEffect(() => {
    if (!editor) return;
    if (lastGen.current === syncGeneration) return;
    lastGen.current = syncGeneration;
    editor.commands.setContent(astToTiptap(model.ast));
  }, [editor, syncGeneration, model.ast]);

  const metrics = pageMetrics(model.resolvedMdoc);
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
    <div className="flex-1 overflow-auto bg-[#d8dee6] py-8">
      <div
        className="relative mx-auto bg-white shadow-page"
        style={{
          width: metrics.widthPx,
          minHeight: metrics.heightPx * 1.15,
          transform: `scale(${zoom})`,
          transformOrigin: "top center",
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
        <div className="page-overlay" aria-hidden>
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
            <span>{resolveVariables(header.right ?? "", { ...vars, page: "1", pages: "1" }).replace("1 / 1", "1 / …")}</span>
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
  );
}

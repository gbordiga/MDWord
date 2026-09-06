"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Link as LinkIcon,
  Table as TableIcon,
  Image as ImageIcon,
  Quote,
  Minus,
  Search,
  Files,
  ListTree,
  GitBranch
} from "lucide-react";
import { useApp, type RibbonTab } from "@/lib/store";
import { BUILT_IN_TEMPLATES } from "@mdword/layout-engine";
import {
  applyBlockStyle,
  currentBlockStyle,
  insertCallout,
  insertPageBreak,
  insertTable,
  promptImage,
  promptLink,
  promptWikilink
} from "@/lib/editorCommands";

const TABS: { id: RibbonTab; label: string }[] = [
  { id: "file", label: "File" },
  { id: "home", label: "Home" },
  { id: "insert", label: "Insert" },
  { id: "layout", label: "Layout" },
  { id: "references", label: "References" },
  { id: "view", label: "View" }
];

function Btn({
  onClick,
  children,
  title
}: {
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] text-[#1c1f24] hover:bg-[#eef2f6]"
    >
      {children}
    </button>
  );
}

export function Ribbon({ editor }: { editor: Editor | null }) {
  const ribbon = useApp((s) => s.ribbon);
  const setRibbon = useApp((s) => s.setRibbon);
  const actions = useApp();

  return (
    <div className="hidden border-b border-[#e4e7ec] bg-white lg:block">
      <div className="flex items-center gap-1 px-2 pt-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setRibbon(tab.id)}
            className={`rounded-t-md px-3 py-1.5 text-[13px] ${
              ribbon === tab.id ? "bg-[#f8fafc] font-medium text-accent" : "text-[#4b5563]"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="ml-auto pr-3 text-[12px] text-[#667085]">MDWord</div>
      </div>
      <div className="flex flex-wrap items-center gap-1 bg-[#f8fafc] px-2 py-1.5">
        {ribbon === "file" && (
          <>
            <Btn title="New" onClick={actions.newDocument}>New</Btn>
            <Btn title="Open" onClick={() => void actions.openFile()}>Open</Btn>
            <Btn title="Save" onClick={() => void actions.saveFile()}>Save</Btn>
            <Btn title="Save as" onClick={() => void actions.saveFileAs()}>Save as</Btn>
            <Btn title="Open folder" onClick={() => void actions.openFolder()}>Open folder</Btn>
            <Btn title="Export PDF" onClick={() => void actions.exportPdf()}>Export PDF</Btn>
            <Btn title="Export HTML" onClick={() => void actions.exportHtml()}>Export HTML</Btn>
          </>
        )}
        {ribbon === "home" && editor && (
          <>
            <select
              aria-label="Style"
              data-testid="ribbon-style"
              className="h-8 rounded-md border border-[#e4e7ec] bg-white px-2 text-[13px]"
              value={currentBlockStyle(editor)}
              onChange={(e) => applyBlockStyle(editor, e.target.value)}
            >
              <option value="p">Body</option>
              <option value="1">Heading 1</option>
              <option value="2">Heading 2</option>
              <option value="3">Heading 3</option>
              <option value="4">Heading 4</option>
            </select>
            <Btn title="Bold" onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={16} /></Btn>
            <Btn title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={16} /></Btn>
            <Btn title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={16} /></Btn>
            <Btn title="Code" onClick={() => editor.chain().focus().toggleCode().run()}><Code size={16} /></Btn>
            <Btn title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></Btn>
            <Btn title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></Btn>
            <Btn title="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={16} /></Btn>
            <Btn title="Link" onClick={() => promptLink(editor)}>
              <LinkIcon size={16} />
            </Btn>
          </>
        )}
        {ribbon === "insert" && editor && (
          <>
            <Btn title="Table" onClick={() => insertTable(editor)}><TableIcon size={16} /> Table</Btn>
            <Btn title="Image" onClick={() => promptImage(editor)}>
              <ImageIcon size={16} /> Image
            </Btn>
            <Btn title="Callout" onClick={() => insertCallout(editor)}>Callout</Btn>
            <Btn title="Code block" onClick={() => editor.chain().focus().toggleCodeBlock().run()}>Code</Btn>
            <Btn title="Page break" onClick={() => insertPageBreak(editor)}><Minus size={16} /> Page break</Btn>
            <Btn title="Wikilink" onClick={() => promptWikilink(editor)}>
              Wikilink
            </Btn>
            <Btn title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>Rule</Btn>
          </>
        )}
        {ribbon === "layout" && (
          <>
            <select
              className="h-8 rounded-md border border-[#e4e7ec] bg-white px-2 text-[13px]"
              value={typeof actions.model.resolvedMdoc.page?.size === "string" ? actions.model.resolvedMdoc.page.size : "A4"}
              onChange={(e) =>
                actions.patchMdoc({
                  ...actions.model.mdoc,
                  page: { ...actions.model.mdoc.page, size: e.target.value as "A4" }
                })
              }
            >
              {["A4", "A3", "A5", "Letter", "Legal"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <Btn
              title="Orientation"
              onClick={() =>
                actions.patchMdoc({
                  ...actions.model.mdoc,
                  page: {
                    ...actions.model.mdoc.page,
                    orientation:
                      actions.model.resolvedMdoc.page?.orientation === "landscape"
                        ? "portrait"
                        : "landscape"
                  }
                })
              }
            >
              {actions.model.resolvedMdoc.page?.orientation === "landscape" ? "Landscape" : "Portrait"}
            </Btn>
            <select
              className="h-8 rounded-md border border-[#e4e7ec] bg-white px-2 text-[13px]"
              value={actions.model.mdoc.template ?? "normal"}
              onChange={(e) => actions.patchMdoc({ ...actions.model.mdoc, template: e.target.value })}
            >
              {BUILT_IN_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </>
        )}
        {ribbon === "references" && (
          <>
            <Btn
              title="Table of contents"
              onClick={() =>
                actions.patchMdoc({
                  ...actions.model.mdoc,
                  toc: { enabled: !actions.model.resolvedMdoc.toc?.enabled, depth: 3 }
                })
              }
            >
              TOC
            </Btn>
          </>
        )}
        {ribbon === "view" && (
          <>
            <Btn title="Document" onClick={() => actions.setView("document")}>Document</Btn>
            <Btn title="Source" onClick={() => actions.setView("source")}>Source</Btn>
            <Btn title="Split" onClick={() => actions.setView("split")}>Split</Btn>
            <Btn title="Outline" onClick={() => actions.setLeft("outline")}><ListTree size={16} /></Btn>
            <Btn title="Files" onClick={() => actions.setLeft("files")}><Files size={16} /></Btn>
            <Btn title="Search" onClick={() => actions.setLeft("search")}><Search size={16} /></Btn>
            <Btn title="Backlinks" onClick={() => actions.setLeft("backlinks")}><GitBranch size={16} /></Btn>
            <Btn title="Zoom out" onClick={() => actions.setZoom(actions.zoom - 0.1)}>-</Btn>
            <span className="px-1 text-[12px] text-[#667085]">{Math.round(actions.zoom * 100)}%</span>
            <Btn title="Zoom in" onClick={() => actions.setZoom(actions.zoom + 0.1)}>+</Btn>
            <Btn title="Toggle left sidebar" onClick={actions.toggleLeft}>Sidebar</Btn>
            <Btn title="Toggle properties" onClick={actions.toggleRight}>Properties</Btn>
          </>
        )}
      </div>
    </div>
  );
}

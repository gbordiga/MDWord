"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  Underline as UnderlineIcon,
  Code,
  List,
  ListOrdered,
  Link as LinkIcon,
  Link2,
  Table as TableIcon,
  Image as ImageIcon,
  Quote,
  Minus,
  Search,
  Files,
  ListTree,
  GitBranch,
  FilePlus,
  FolderOpen,
  Save,
  SaveAll,
  Folder,
  FileDown,
  FileCode,
  StickyNote,
  SquareCode,
  FileText,
  Columns2,
  ZoomIn,
  ZoomOut,
  PanelLeft,
  PanelRight,
  Scissors,
  RectangleHorizontal,
  RectangleVertical
} from "lucide-react";
import { useApp, type RibbonTab } from "@/lib/store";
import { BUILT_IN_TEMPLATES } from "@mdword/layout-engine";
import { applyBlockStyle, currentBlockStyle, insertCallout, insertPageBreak, insertTable } from "@/lib/editorCommands";
import { useEditorTick } from "@/hooks/useEditorTick";
import { useEditorUi } from "@/lib/editorUi";
import { Spinner } from "./Spinner";

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
  title,
  testId,
  pressed,
  disabled,
  busy
}: {
  onClick: () => void;
  children: React.ReactNode;
  title: string;
  testId?: string;
  pressed?: boolean;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      data-testid={testId}
      disabled={disabled || busy}
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] text-[#1c1f24] hover:bg-[#eef2f6] disabled:cursor-not-allowed disabled:opacity-50 ${
        pressed ? "bg-[#e8eefc] text-accent" : ""
      }`}
    >
      {busy ? <Spinner size={14} /> : null}
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1.5 h-5 w-px shrink-0 self-center bg-[#98a2b3]" aria-hidden />;
}

export function Ribbon({ editor }: { editor: Editor | null }) {
  useEditorTick(editor);
  const ribbon = useApp((s) => s.ribbon);
  const setRibbon = useApp((s) => s.setRibbon);
  const actions = useApp();
  const busy = useApp((s) => s.busy);
  const { openLink, openImage, openWikilink, confirmIfDirty } = useEditorUi();
  const fileBusy = Boolean(busy);
  const templateId = actions.model.mdoc.template ?? "normal";
  const template = BUILT_IN_TEMPLATES.find((t) => t.id === templateId);
  const tocEnabled = Boolean(actions.model.resolvedMdoc.toc?.enabled);
  const tocDepth = actions.model.resolvedMdoc.toc?.depth ?? 3;
  const landscape = actions.model.resolvedMdoc.page?.orientation === "landscape";

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
            <Btn title="New" onClick={() => confirmIfDirty(actions.newDocument)} disabled={fileBusy}>
              <FilePlus size={16} /> New
            </Btn>
            <Btn title="Open" onClick={() => confirmIfDirty(() => void actions.openFile())} disabled={fileBusy}>
              <FolderOpen size={16} /> Open
            </Btn>
            <Divider />
            <Btn title="Save" onClick={() => void actions.saveFile()} busy={busy?.kind === "save"} disabled={fileBusy && busy?.kind !== "save"}>
              <Save size={16} /> Save
            </Btn>
            <Btn title="Save as" onClick={() => void actions.saveFileAs()} disabled={fileBusy}>
              <SaveAll size={16} /> Save as
            </Btn>
            <Divider />
            <Btn title="Open folder" onClick={() => void actions.openFolder()} busy={busy?.kind === "folder"} disabled={fileBusy}>
              <Folder size={16} /> Open folder
            </Btn>
            <Divider />
            <Btn title="Export PDF" onClick={() => void actions.exportPdf()} busy={busy?.kind === "export"} disabled={fileBusy}>
              <FileDown size={16} /> Export PDF
            </Btn>
            <Btn title="Export HTML" onClick={() => void actions.exportHtml()} disabled={fileBusy}>
              <FileCode size={16} /> Export HTML
            </Btn>
          </>
        )}
        {ribbon === "home" && (
          <>
            <select
              aria-label="Style"
              data-testid="ribbon-style"
              className="h-8 rounded-md border border-[#e4e7ec] bg-white px-2 text-[13px]"
              value={currentBlockStyle(editor)}
              onChange={(e) => editor && applyBlockStyle(editor, e.target.value)}
            >
              <option value="p">Body</option>
              <option value="1">Heading 1</option>
              <option value="2">Heading 2</option>
              <option value="3">Heading 3</option>
              <option value="4">Heading 4</option>
            </select>
            <Divider />
            <Btn
              title="Bold"
              pressed={editor?.isActive("bold")}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              <Bold size={16} />
            </Btn>
            <Btn
              title="Italic"
              pressed={editor?.isActive("italic")}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              <Italic size={16} />
            </Btn>
            <Btn
              title="Underline"
              pressed={editor?.isActive("underline")}
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
            >
              <UnderlineIcon size={16} />
            </Btn>
            <Btn
              title="Strikethrough"
              pressed={editor?.isActive("strike")}
              onClick={() => editor?.chain().focus().toggleStrike().run()}
            >
              <Strikethrough size={16} />
            </Btn>
            <Btn
              title="Code"
              pressed={editor?.isActive("code")}
              onClick={() => editor?.chain().focus().toggleCode().run()}
            >
              <Code size={16} />
            </Btn>
            <Divider />
            <Btn
              title="Bullet list"
              testId="fmt-bullet"
              pressed={editor?.isActive("bulletList")}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              <List size={16} />
            </Btn>
            <Btn
              title="Numbered list"
              testId="fmt-ordered"
              pressed={editor?.isActive("orderedList")}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered size={16} />
            </Btn>
            <Divider />
            <Btn
              title="Quote"
              testId="fmt-quote"
              pressed={editor?.isActive("blockquote")}
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            >
              <Quote size={16} />
            </Btn>
            <Btn title="Link" testId="fmt-link" pressed={editor?.isActive("link")} onClick={openLink}>
              <LinkIcon size={16} />
            </Btn>
          </>
        )}
        {ribbon === "insert" && (
          <>
            <Btn title="Table" testId="insert-table" onClick={() => editor && insertTable(editor)}>
              <TableIcon size={16} /> Table
            </Btn>
            <Btn title="Image" onClick={openImage}>
              <ImageIcon size={16} /> Image
            </Btn>
            <Divider />
            <Btn title="Callout" testId="insert-callout" onClick={() => editor && insertCallout(editor)}>
              <StickyNote size={16} /> Callout
            </Btn>
            <Btn title="Code block" onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>
              <SquareCode size={16} /> Code
            </Btn>
            <Divider />
            <Btn title="Page break" onClick={() => editor && insertPageBreak(editor)}>
              <Scissors size={16} /> Page break
            </Btn>
            <Divider />
            <Btn title="Wikilink" onClick={openWikilink}>
              <Link2 size={16} /> Wikilink
            </Btn>
            <Btn title="Horizontal rule" onClick={() => editor?.chain().focus().setHorizontalRule().run()}>
              <Minus size={16} /> Rule
            </Btn>
          </>
        )}
        {ribbon === "layout" && (
          <>
            <select
              aria-label="Page size"
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
                    orientation: landscape ? "portrait" : "landscape"
                  }
                })
              }
            >
              {landscape ? <RectangleHorizontal size={16} /> : <RectangleVertical size={16} />}
              {landscape ? "Landscape" : "Portrait"}
            </Btn>
            <Divider />
            <select
              aria-label="Template"
              data-testid="ribbon-template"
              className="h-8 max-w-[14rem] rounded-md border border-[#e4e7ec] bg-white px-2 text-[13px]"
              value={templateId}
              onChange={(e) => actions.patchMdoc({ ...actions.model.mdoc, template: e.target.value })}
            >
              {BUILT_IN_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id} title={t.description}>
                  {t.name}
                </option>
              ))}
            </select>
            {template ? (
              <span
                className="max-w-md truncate px-1 text-[11px] text-[#667085]"
                data-testid="template-hint"
                title={template.description}
              >
                {template.description}
              </span>
            ) : null}
          </>
        )}
        {ribbon === "references" && (
          <>
            <Btn
              title="Show a live table of contents generated from headings"
              testId="insert-toc"
              pressed={tocEnabled}
              onClick={() =>
                actions.patchMdoc({
                  ...actions.model.mdoc,
                  toc: { enabled: !tocEnabled, depth: tocDepth }
                })
              }
            >
              <ListTree size={16} /> Table of contents
            </Btn>
            {tocEnabled ? (
              <select
                aria-label="Table of contents depth"
                data-testid="toc-depth"
                className="h-8 rounded-md border border-[#e4e7ec] bg-white px-2 text-[13px]"
                value={tocDepth}
                onChange={(e) =>
                  actions.patchMdoc({
                    ...actions.model.mdoc,
                    toc: { enabled: true, depth: Number(e.target.value) }
                  })
                }
              >
                {[1, 2, 3, 4, 5, 6].map((d) => (
                  <option key={d} value={d}>
                    Heading depth {d}
                  </option>
                ))}
              </select>
            ) : null}
            <span className="px-1 text-[11px] text-[#667085]">
              Updates automatically from headings. Not inserted into the document body.
            </span>
          </>
        )}
        {ribbon === "view" && (
          <>
            <Btn title="Document" pressed={actions.view === "document"} onClick={() => actions.setView("document")}>
              <FileText size={16} /> Document
            </Btn>
            <Btn title="Source" pressed={actions.view === "source"} onClick={() => actions.setView("source")}>
              <Code size={16} /> Source
            </Btn>
            <Btn title="Split" pressed={actions.view === "split"} onClick={() => actions.setView("split")}>
              <Columns2 size={16} /> Split
            </Btn>
            <Divider />
            <Btn title="Outline" onClick={() => actions.setLeft("outline")}>
              <ListTree size={16} />
            </Btn>
            <Btn title="Files" onClick={() => actions.setLeft("files")}>
              <Files size={16} />
            </Btn>
            <Btn title="Search" onClick={() => actions.setLeft("search")}>
              <Search size={16} />
            </Btn>
            <Btn title="Backlinks" onClick={() => actions.setLeft("backlinks")}>
              <GitBranch size={16} />
            </Btn>
            <Divider />
            <Btn title="Find" testId="open-find" onClick={() => actions.setFind(true)}>
              <Search size={16} /> Find
            </Btn>
            <Divider />
            <Btn title="Zoom out" onClick={() => actions.setZoom(actions.zoom - 0.1)}>
              <ZoomOut size={16} />
            </Btn>
            <span className="px-1 text-[12px] text-[#667085]">{Math.round(actions.zoom * 100)}%</span>
            <Btn title="Zoom in" onClick={() => actions.setZoom(actions.zoom + 0.1)}>
              <ZoomIn size={16} />
            </Btn>
            <Divider />
            <Btn title="Toggle left sidebar" onClick={actions.toggleLeft}>
              <PanelLeft size={16} /> Sidebar
            </Btn>
            <Btn title="Toggle properties" onClick={actions.toggleRight}>
              <PanelRight size={16} /> Properties
            </Btn>
          </>
        )}
      </div>
    </div>
  );
}

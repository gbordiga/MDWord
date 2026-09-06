"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold,
  Code,
  FilePlus,
  FileText,
  Files,
  FolderOpen,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Menu,
  Minus,
  MoreHorizontal,
  PanelRight,
  Plus,
  Quote,
  Save,
  Search,
  Strikethrough,
  Table as TableIcon,
  Underline as UnderlineIcon
} from "lucide-react";
import { type ReactNode } from "react";
import { displayDocumentTitle } from "@mdword/shared";
import { useApp } from "@/lib/store";
import {
  applyBlockStyle,
  currentBlockStyle,
  insertCallout,
  insertPageBreak,
  insertTable
} from "@/lib/editorCommands";
import { useEditorTick } from "@/hooks/useEditorTick";
import { useEditorUi } from "@/lib/editorUi";
import { Spinner } from "./Spinner";
import { LeftSidebar } from "./LeftSidebar";
import { PropertiesPanel } from "./PropertiesPanel";
import { Sheet } from "./Sheet";

function IconBtn({
  title,
  onClick,
  pressed,
  testId,
  children
}: {
  title: string;
  onClick: () => void;
  pressed?: boolean;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      data-testid={testId}
      onClick={onClick}
      className={`inline-flex h-11 min-w-11 shrink-0 items-center justify-center rounded-lg px-2 text-[#1c1f24] touch-manipulation ${
        pressed ? "bg-[#e8eefc] text-accent" : "hover:bg-[#eef2f6] active:bg-[#e8eefc]"
      }`}
    >
      {children}
    </button>
  );
}

export function MobileTopBar() {
  const dirty = useApp((s) => s.dirty);
  const path = useApp((s) => s.path);
  const title = useApp((s) => displayDocumentTitle(s.model.frontmatter, s.path));
  const setMobileSheet = useApp((s) => s.setMobileSheet);
  const saveFile = useApp((s) => s.saveFile);
  const saving = useApp((s) => s.busy?.kind === "save");

  return (
    <header
      data-testid="mobile-top-bar"
      className="flex shrink-0 items-center gap-1 border-b border-[#e4e7ec] bg-white pl-[max(4px,env(safe-area-inset-left))] pr-[max(4px,env(safe-area-inset-right))] pt-[env(safe-area-inset-top)] lg:hidden"
    >
      <IconBtn title="Workspace" onClick={() => setMobileSheet("workspace")}>
        <Menu size={22} />
      </IconBtn>
      <div className="min-w-0 flex-1 py-2">
        <div className="truncate text-[15px] font-semibold leading-tight text-[#1c1f24]">
          {title}
          {dirty ? <span className="ml-1 text-accent">•</span> : null}
        </div>
        <div className="truncate text-[11px] text-[#667085]">{path ?? "Unsaved"}</div>
      </div>
      <IconBtn title="Save" onClick={() => void saveFile()}>
        {saving ? <Spinner size={18} /> : <Save size={20} />}
      </IconBtn>
      <IconBtn title="More" onClick={() => setMobileSheet("more")}>
        <MoreHorizontal size={22} />
      </IconBtn>
    </header>
  );
}

export function MobileFormatBar({ editor }: { editor: Editor | null }) {
  useEditorTick(editor);
  const view = useApp((s) => s.view);
  const { openLink } = useEditorUi();
  if (view === "source") return null;

  return (
    <div
      data-testid="mobile-format-bar"
      className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-[#e4e7ec] bg-[#f8fafc] px-2 py-1 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
    >
      <select
        aria-label="Style"
        data-testid="mobile-style"
        className="h-11 min-w-[7.5rem] rounded-lg border border-[#e4e7ec] bg-white px-2 text-[16px]"
        value={currentBlockStyle(editor)}
        onChange={(e) => editor && applyBlockStyle(editor, e.target.value)}
      >
        <option value="p">Body</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
        <option value="4">Heading 4</option>
      </select>
      <IconBtn
        title="Bold"
        pressed={editor?.isActive("bold")}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      >
        <Bold size={18} />
      </IconBtn>
      <IconBtn
        title="Italic"
        pressed={editor?.isActive("italic")}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      >
        <Italic size={18} />
      </IconBtn>
      <IconBtn
        title="Underline"
        pressed={editor?.isActive("underline")}
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon size={18} />
      </IconBtn>
      <IconBtn
        title="Strikethrough"
        pressed={editor?.isActive("strike")}
        onClick={() => editor?.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={18} />
      </IconBtn>
      <IconBtn
        title="Code"
        pressed={editor?.isActive("code")}
        onClick={() => editor?.chain().focus().toggleCode().run()}
      >
        <Code size={18} />
      </IconBtn>
      <IconBtn
        title="Bullet list"
        testId="fmt-bullet"
        pressed={editor?.isActive("bulletList")}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      >
        <List size={18} />
      </IconBtn>
      <IconBtn
        title="Numbered list"
        testId="fmt-ordered"
        pressed={editor?.isActive("orderedList")}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={18} />
      </IconBtn>
      <IconBtn
        title="Quote"
        testId="fmt-quote"
        pressed={editor?.isActive("blockquote")}
        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={18} />
      </IconBtn>
      <IconBtn title="Link" testId="fmt-link" pressed={editor?.isActive("link")} onClick={openLink}>
        <LinkIcon size={18} />
      </IconBtn>
    </div>
  );
}

function Tab({
  label,
  active,
  onClick,
  children
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 touch-manipulation ${
        active ? "text-accent" : "text-[#667085]"
      }`}
    >
      {children}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}

export function MobileTabBar({ keyboardOpen }: { keyboardOpen: boolean }) {
  const sheet = useApp((s) => s.mobileSheet);
  const setMobileSheet = useApp((s) => s.setMobileSheet);
  const view = useApp((s) => s.view);
  const setView = useApp((s) => s.setView);

  if (keyboardOpen) return null;

  return (
    <nav
      data-testid="mobile-tab-bar"
      aria-label="Primary"
      className="mt-auto flex shrink-0 border-t border-[#e4e7ec] bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <Tab
        label="Document"
        active={sheet === null && view !== "source"}
        onClick={() => {
          setView("document");
          setMobileSheet(null);
        }}
      >
        <FileText size={20} />
      </Tab>
      <Tab label="Files" active={sheet === "workspace"} onClick={() => setMobileSheet("workspace")}>
        <Files size={20} />
      </Tab>
      <Tab label="Insert" active={sheet === "insert"} onClick={() => setMobileSheet("insert")}>
        <Plus size={20} />
      </Tab>
      <Tab
        label="Properties"
        active={sheet === "properties"}
        onClick={() => setMobileSheet("properties")}
      >
        <PanelRight size={20} />
      </Tab>
    </nav>
  );
}

function InsertItem({
  label,
  onClick,
  children
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 items-center gap-3 rounded-xl px-3 text-left text-[15px] text-[#1c1f24] hover:bg-[#f2f4f7] active:bg-[#e8eefc] touch-manipulation"
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#f2f4f7] text-[#344054]">
        {children}
      </span>
      {label}
    </button>
  );
}

function MoreItem({ label, onClick, children }: { label: string; onClick: () => void; children?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-[15px] text-[#1c1f24] hover:bg-[#f2f4f7] touch-manipulation"
    >
      {children}
      {label}
    </button>
  );
}

export function MobileSheets({ editor }: { editor: Editor | null }) {
  const sheet = useApp((s) => s.mobileSheet);
  const setMobileSheet = useApp((s) => s.setMobileSheet);
  const close = () => setMobileSheet(null);
  const actions = useApp();
  const { openImage, openWikilink, confirmIfDirty } = useEditorUi();

  const run = (fn: () => void) => {
    fn();
    close();
  };

  return (
    <>
      <Sheet open={sheet === "workspace"} onClose={close} side="left" title="Workspace" testId="sheet-workspace">
        <LeftSidebar className="h-full w-full border-r-0" />
      </Sheet>
      <Sheet open={sheet === "properties"} onClose={close} side="bottom" title="Properties" testId="sheet-properties">
        <PropertiesPanel className="h-auto w-full border-l-0" />
      </Sheet>
      <Sheet open={sheet === "insert"} onClose={close} side="bottom" title="Insert" testId="sheet-insert">
        <div className="grid grid-cols-1 gap-1 p-2 pb-4">
          <InsertItem label="Table" onClick={() => editor && run(() => insertTable(editor))}>
            <TableIcon size={18} />
          </InsertItem>
          <InsertItem label="Image" onClick={() => run(openImage)}>
            <ImageIcon size={18} />
          </InsertItem>
          <InsertItem label="Callout" onClick={() => editor && run(() => insertCallout(editor))}>
            <Quote size={18} />
          </InsertItem>
          <InsertItem label="Code block" onClick={() => editor && run(() => editor.chain().focus().toggleCodeBlock().run())}>
            <Code size={18} />
          </InsertItem>
          <InsertItem label="Page break" onClick={() => editor && run(() => insertPageBreak(editor))}>
            <Minus size={18} />
          </InsertItem>
          <InsertItem label="Wikilink" onClick={() => run(openWikilink)}>
            <LinkIcon size={18} />
          </InsertItem>
          <InsertItem
            label="Horizontal rule"
            onClick={() => editor && run(() => editor.chain().focus().setHorizontalRule().run())}
          >
            <Minus size={18} />
          </InsertItem>
        </div>
      </Sheet>
      <Sheet open={sheet === "more"} onClose={close} side="bottom" title="More" testId="sheet-more">
        <div className="py-1">
          <MoreItem label="New document" onClick={() => run(() => confirmIfDirty(actions.newDocument))}>
            <FilePlus size={18} />
          </MoreItem>
          <MoreItem label="Open" onClick={() => run(() => confirmIfDirty(() => void actions.openFile()))}>
            <FolderOpen size={18} />
          </MoreItem>
          <MoreItem label="Save as" onClick={() => run(() => void actions.saveFileAs())}>
            <Save size={18} />
          </MoreItem>
          <MoreItem label="Open folder" onClick={() => run(() => void actions.openFolder())}>
            <FolderOpen size={18} />
          </MoreItem>
          <div className="my-1 h-px bg-[#e4e7ec]" />
          <MoreItem label="Document view" onClick={() => run(() => actions.setView("document"))}>
            <FileText size={18} />
          </MoreItem>
          <MoreItem
            label="Source"
            onClick={() =>
              run(() => {
                actions.setView("source");
              })
            }
          >
            <Code size={18} />
          </MoreItem>
          <MoreItem label="Split view" onClick={() => run(() => actions.setView("split"))}>
            <Files size={18} />
          </MoreItem>
          <MoreItem label="Find in document" onClick={() => run(() => actions.setFind(true))}>
            <Search size={18} />
          </MoreItem>
          <div className="my-1 h-px bg-[#e4e7ec]" />
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-[15px]">Zoom</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-[#f2f4f7]"
                aria-label="Zoom out"
                onClick={() => actions.setZoom(actions.zoom - 0.1)}
              >
                −
              </button>
              <span className="w-12 text-center text-[13px] text-[#667085]">
                {Math.round(actions.zoom * 100)}%
              </span>
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-[#f2f4f7]"
                aria-label="Zoom in"
                onClick={() => actions.setZoom(actions.zoom + 0.1)}
              >
                +
              </button>
            </div>
          </div>
          <div className="my-1 h-px bg-[#e4e7ec]" />
          <MoreItem label="Export PDF" onClick={() => run(() => void actions.exportPdf())} />
          <MoreItem label="Export HTML" onClick={() => run(() => void actions.exportHtml())} />
          <MoreItem
            label="Command palette"
            onClick={() =>
              run(() => {
                actions.setPalette(true);
              })
            }
          >
            <Search size={18} />
          </MoreItem>
        </div>
      </Sheet>
    </>
  );
}

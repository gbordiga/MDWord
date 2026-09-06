"use client";

import { useEffect, useMemo, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Dialog, DialogButton, DialogField, dialogInputClass } from "./Dialog";
import { insertWikilink } from "@/lib/editorCommands";
import { useApp } from "@/lib/store";

export function WikilinkDialog({
  open,
  editor,
  onClose
}: {
  open: boolean;
  editor: Editor | null;
  onClose: () => void;
}) {
  const files = useApp((s) => s.workspace?.files ?? []);
  const documents = useApp((s) => s.workspace?.index.documents ?? []);
  const [target, setTarget] = useState("");
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!open) return;
    setTarget("");
    setLabel("");
  }, [open]);

  const options = useMemo(() => {
    const q = target.trim().toLowerCase();
    const fromIndex = documents.map((d) => ({
      path: d.path,
      title: d.title,
      name: d.path.split(/[/\\]/).pop() ?? d.path
    }));
    const fromFiles = files
      .filter((f) => /\.(md|markdown)$/i.test(f.name))
      .map((f) => ({ path: f.path, title: f.name.replace(/\.md$/i, ""), name: f.name }));
    const seen = new Set<string>();
    const merged = [...fromIndex, ...fromFiles].filter((item) => {
      const key = item.path.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (!q) return merged.slice(0, 20);
    return merged.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.path.toLowerCase().includes(q)
    );
  }, [documents, files, target]);

  const canInsert = Boolean(target.trim());

  const insert = (value = target) => {
    if (!editor || !value.trim()) return;
    if (insertWikilink(editor, value, label)) onClose();
  };

  return (
    <Dialog
      open={open}
      title="Insert wikilink"
      onClose={onClose}
      testId="wikilink-dialog"
      footer={
        <>
          <DialogButton onClick={onClose}>Cancel</DialogButton>
          <DialogButton variant="primary" testId="wikilink-insert" disabled={!canInsert} onClick={() => insert()}>
            Insert
          </DialogButton>
        </>
      }
    >
      <DialogField label="Document">
        <input
          data-testid="wikilink-target"
          className={dialogInputClass}
          placeholder="Page name"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              insert();
            }
          }}
        />
      </DialogField>
      <DialogField label="Label (optional)">
        <input
          data-testid="wikilink-label"
          className={dialogInputClass}
          placeholder="Visible text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </DialogField>
      {options.length > 0 ? (
        <ul className="max-h-40 overflow-auto rounded-md border border-[#e4e7ec]" data-testid="wikilink-results">
          {options.map((item) => (
            <li key={item.path}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center px-3 text-left text-[14px] hover:bg-[#f2f4f7]"
                onClick={() => insert(item.title)}
              >
                {item.title}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-[#667085]">
          Open a folder to pick a page, or type a target name to insert <code>[[target]]</code>.
        </p>
      )}
    </Dialog>
  );
}

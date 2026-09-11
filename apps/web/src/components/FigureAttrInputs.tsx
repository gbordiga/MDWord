"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { clampImageWidth } from "@mdword/editor";

export function FigureWidthInput({
  editor,
  enabled,
  width,
  testId,
  className
}: {
  editor: Editor | null;
  enabled: boolean;
  width: number;
  testId?: string;
  className: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      data-testid={testId}
      type="number"
      min={10}
      max={100}
      disabled={!enabled}
      className={className}
      value={enabled ? (draft ?? String(width)) : ""}
      onFocus={() => setDraft(String(width))}
      onChange={(event) => {
        const value = event.target.value;
        setDraft(value);
        const next = Number(value);
        if (Number.isFinite(next) && next >= 10 && next <= 100) {
          editor?.commands.updateFigure({ width: next });
        }
      }}
      onBlur={() => {
        const next = Number(draft);
        if (Number.isFinite(next)) editor?.commands.updateFigure({ width: clampImageWidth(next) });
        setDraft(null);
      }}
    />
  );
}

export function FigureTextInput({
  enabled,
  value,
  testId,
  className,
  placeholder,
  onCommit
}: {
  enabled: boolean;
  value: string;
  testId?: string;
  className: string;
  placeholder?: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      data-testid={testId}
      disabled={!enabled}
      className={className}
      placeholder={placeholder}
      value={enabled ? (draft ?? value) : ""}
      onFocus={() => setDraft(value)}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        onCommit(next);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

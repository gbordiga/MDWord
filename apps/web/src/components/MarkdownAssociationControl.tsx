"use client";

import { FileCheck2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getHost } from "@/lib/host";

export type MarkdownAssociationStatus = {
  supported: boolean;
  isDefault: boolean;
  missing?: string[];
  platform?: "win32" | "darwin" | "linux" | "other";
};

function associationHint(status: MarkdownAssociationStatus): string {
  if (status.isDefault) return "Double-clicking Markdown files already opens MDWord.";
  if (status.platform === "darwin") {
    return "Opens System Settings so you can choose MDWord for Markdown files.";
  }
  if (status.platform === "linux") {
    return "Registers MDWord as the Freedesktop handler for Markdown and opens your system file-type settings.";
  }
  return "Opens Windows Settings so you can choose MDWord for .md, .markdown, .mdown and .mkd.";
}

export function useMarkdownAssociation(): {
  status: MarkdownAssociationStatus | null;
  setAsDefault: () => Promise<void>;
} {
  const [status, setStatus] = useState<MarkdownAssociationStatus | null>(null);

  useEffect(() => {
    const read = getHost().app.getMarkdownAssociation;
    if (!read) {
      setStatus({ supported: false, isDefault: false });
      return;
    }
    const refresh = () => {
      void read().then(setStatus);
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const setAsDefault = useCallback(async () => {
    const write = getHost().app.setMarkdownAssociation;
    if (!write) return;
    setStatus(await write());
    const read = getHost().app.getMarkdownAssociation;
    if (!read) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      void read().then((next) => {
        setStatus(next);
        if (next.isDefault || Date.now() - started > 60_000) window.clearInterval(timer);
      });
    }, 800);
  }, []);

  return { status, setAsDefault };
}

export function MarkdownAssociationButton({
  className,
  testId = "associate-markdown"
}: {
  className?: string;
  testId?: string;
}) {
  const { status, setAsDefault } = useMarkdownAssociation();
  if (!status?.supported) return null;
  return (
    <button
      type="button"
      title={associationHint(status)}
      aria-label={
        status.isDefault
          ? "MDWord is the default app for Markdown files"
          : "Set MDWord as the default app for .md files"
      }
      aria-pressed={status.isDefault}
      data-testid={testId}
      onClick={() => void setAsDefault()}
      className={className}
    >
      <FileCheck2 size={16} />
      {status.isDefault ? "Default for Markdown" : "Set as .md default"}
    </button>
  );
}

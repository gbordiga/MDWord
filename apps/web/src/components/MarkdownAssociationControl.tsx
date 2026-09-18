"use client";

import { FileCheck2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getHost } from "@/lib/host";

export type MarkdownAssociationStatus = {
  supported: boolean;
  isDefault: boolean;
};

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
    void read().then(setStatus);
  }, []);

  const setAsDefault = useCallback(async () => {
    const write = getHost().app.setMarkdownAssociation;
    if (!write) return;
    setStatus(await write());
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
      title={status.isDefault ? "MDWord already opens .md files" : "Use MDWord to open .md files"}
      aria-label={status.isDefault ? "MDWord already opens .md files" : "Open .md files with MDWord"}
      aria-pressed={status.isDefault}
      data-testid={testId}
      onClick={() => void setAsDefault()}
      className={className}
    >
      <FileCheck2 size={16} />
      {status.isDefault ? ".md default" : "Open .md files"}
    </button>
  );
}

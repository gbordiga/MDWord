"use client";

import type { TocItem } from "@mdword/renderer";

export function DocumentToc({
  items,
  numbered,
  onJump
}: {
  items: TocItem[];
  numbered: boolean;
  onJump?: (index: number) => void;
}) {
  return (
    <nav className="md-toc" data-testid="document-toc" aria-label="Table of contents">
      <h2 className="md-toc-title">Contents</h2>
      {items.length === 0 ? (
        <p className="md-toc-empty">No headings yet. Add headings and this list updates automatically.</p>
      ) : (
        <ol className="md-toc-list">
          {items.map((item, index) => (
            <li key={`${item.number}-${item.text}-${index}`} className={`md-toc-d${item.depth}`}>
              <button
                type="button"
                className="md-toc-link"
                onClick={() => onJump?.(index)}
              >
                {numbered ? <span className="md-toc-num">{item.number}</span> : null}
                {item.text}
              </button>
            </li>
          ))}
        </ol>
      )}
    </nav>
  );
}

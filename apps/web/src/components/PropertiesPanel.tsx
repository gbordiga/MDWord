"use client";

import { useApp } from "@/lib/store";

export function PropertiesPanel() {
  const model = useApp((s) => s.model);
  const patchFrontmatter = useApp((s) => s.patchFrontmatter);
  const patchMdoc = useApp((s) => s.patchMdoc);
  const mdoc = model.mdoc;
  const margins = model.resolvedMdoc.margins ?? {};

  return (
    <aside className="h-full w-72 shrink-0 overflow-auto border-l border-[#e4e7ec] bg-white p-3 text-[13px]">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
        Document properties
      </h2>
      <label className="mb-2 block">
        Title
        <input
          className="mt-1 w-full rounded-md border border-[#e4e7ec] px-2 py-1"
          value={String(model.frontmatter.title ?? "")}
          onChange={(e) => patchFrontmatter({ title: e.target.value })}
        />
      </label>
      <label className="mb-2 block">
        Subtitle
        <input
          className="mt-1 w-full rounded-md border border-[#e4e7ec] px-2 py-1"
          value={String(model.frontmatter.subtitle ?? "")}
          onChange={(e) => patchFrontmatter({ subtitle: e.target.value })}
        />
      </label>
      <label className="mb-2 block">
        Date
        <input
          className="mt-1 w-full rounded-md border border-[#e4e7ec] px-2 py-1"
          value={String(model.frontmatter.date ?? "")}
          onChange={(e) => patchFrontmatter({ date: e.target.value })}
        />
      </label>
      <label className="mb-2 block">
        Language
        <input
          className="mt-1 w-full rounded-md border border-[#e4e7ec] px-2 py-1"
          value={String(model.frontmatter.language ?? "it")}
          onChange={(e) => patchFrontmatter({ language: e.target.value })}
        />
      </label>
      <h2 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
        Page
      </h2>
      {(["top", "right", "bottom", "left"] as const).map((side) => (
        <label key={side} className="mb-2 block capitalize">
          {side}
          <input
            className="mt-1 w-full rounded-md border border-[#e4e7ec] px-2 py-1"
            value={String(mdoc.margins?.[side] ?? margins[side] ?? "")}
            onChange={(e) =>
              patchMdoc({
                ...mdoc,
                margins: { ...mdoc.margins, [side]: e.target.value }
              })
            }
          />
        </label>
      ))}
      <label className="mb-2 block">
        Header left
        <input
          className="mt-1 w-full rounded-md border border-[#e4e7ec] px-2 py-1"
          value={mdoc.header?.left ?? model.resolvedMdoc.header?.left ?? ""}
          onChange={(e) =>
            patchMdoc({ ...mdoc, header: { ...mdoc.header, left: e.target.value } })
          }
        />
      </label>
      <label className="mb-2 block">
        Header right
        <input
          className="mt-1 w-full rounded-md border border-[#e4e7ec] px-2 py-1"
          value={mdoc.header?.right ?? model.resolvedMdoc.header?.right ?? ""}
          onChange={(e) =>
            patchMdoc({ ...mdoc, header: { ...mdoc.header, right: e.target.value } })
          }
        />
      </label>
      <label className="mb-2 block">
        Footer right
        <input
          className="mt-1 w-full rounded-md border border-[#e4e7ec] px-2 py-1"
          value={mdoc.footer?.right ?? model.resolvedMdoc.footer?.right ?? ""}
          onChange={(e) =>
            patchMdoc({ ...mdoc, footer: { ...mdoc.footer, right: e.target.value } })
          }
        />
      </label>
      {model.diagnostics.length > 0 && (
        <div className="mt-4 rounded-md bg-[#fffbeb] p-2 text-[12px] text-[#92400e]">
          {model.diagnostics.slice(0, 6).map((d, i) => (
            <div key={i}>{d.message}</div>
          ))}
        </div>
      )}
    </aside>
  );
}

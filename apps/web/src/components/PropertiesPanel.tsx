"use client";

import { cn } from "@mdword/ui";
import { BUILT_IN_TEMPLATES } from "@mdword/layout-engine";
import { documentTitle, documentTitleKey } from "@mdword/shared";
import { useApp } from "@/lib/store";

const fieldClass =
  "mt-1 w-full rounded-md border border-[#e4e7ec] px-3 py-2 text-[16px] lg:px-2 lg:py-1 lg:text-[13px]";

export function PropertiesPanel({ className }: { className?: string }) {
  const model = useApp((s) => s.model);
  const patchFrontmatter = useApp((s) => s.patchFrontmatter);
  const patchMdoc = useApp((s) => s.patchMdoc);
  const mdoc = model.mdoc;
  const titleKey = documentTitleKey(model.frontmatter);
  const margins = model.resolvedMdoc.margins ?? {};
  const pageSize =
    typeof model.resolvedMdoc.page?.size === "string" ? model.resolvedMdoc.page.size : "A4";

  return (
    <aside
      className={cn(
        "h-full w-72 shrink-0 overflow-auto border-l border-[#e4e7ec] bg-white p-3 text-[13px]",
        className
      )}
    >
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
        Document properties
      </h2>
      <label className="mb-2 block">
        Title
        <input
          data-testid="prop-title"
          className={fieldClass}
          value={documentTitle(model.frontmatter, "")}
          onChange={(e) => patchFrontmatter({ [titleKey]: e.target.value })}
        />
      </label>
      <label className="mb-2 block">
        Subtitle
        <input
          className={fieldClass}
          value={String(model.frontmatter.subtitle ?? "")}
          onChange={(e) => patchFrontmatter({ subtitle: e.target.value })}
        />
      </label>
      <label className="mb-2 block">
        Date
        <input
          className={fieldClass}
          value={String(model.frontmatter.date ?? "")}
          onChange={(e) => patchFrontmatter({ date: e.target.value })}
        />
      </label>
      <label className="mb-2 block">
        Language
        <input
          className={fieldClass}
          value={String(model.frontmatter.language ?? "it")}
          onChange={(e) => patchFrontmatter({ language: e.target.value })}
        />
      </label>
      <h2 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
        Page
      </h2>
      <label className="mb-2 block">
        Size
        <select
          className={fieldClass}
          value={pageSize}
          onChange={(e) =>
            patchMdoc({
              ...mdoc,
              page: { ...mdoc.page, size: e.target.value as "A4" }
            })
          }
        >
          {["A4", "A3", "A5", "Letter", "Legal"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="mb-2 block">
        Orientation
        <select
          className={fieldClass}
          value={model.resolvedMdoc.page?.orientation ?? "portrait"}
          onChange={(e) =>
            patchMdoc({
              ...mdoc,
              page: { ...mdoc.page, orientation: e.target.value as "portrait" | "landscape" }
            })
          }
        >
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>
      </label>
      <label className="mb-2 block">
        Template
        <select
          className={fieldClass}
          value={mdoc.template ?? "normal"}
          onChange={(e) => patchMdoc({ ...mdoc, template: e.target.value })}
        >
          {BUILT_IN_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      {(["top", "right", "bottom", "left"] as const).map((side) => (
        <label key={side} className="mb-2 block capitalize">
          {side}
          <input
            className={fieldClass}
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
          className={fieldClass}
          value={mdoc.header?.left ?? model.resolvedMdoc.header?.left ?? ""}
          onChange={(e) =>
            patchMdoc({ ...mdoc, header: { ...mdoc.header, left: e.target.value } })
          }
        />
      </label>
      <label className="mb-2 block">
        Header right
        <input
          className={fieldClass}
          value={mdoc.header?.right ?? model.resolvedMdoc.header?.right ?? ""}
          onChange={(e) =>
            patchMdoc({ ...mdoc, header: { ...mdoc.header, right: e.target.value } })
          }
        />
      </label>
      <label className="mb-2 block">
        Footer right
        <input
          className={fieldClass}
          value={mdoc.footer?.right ?? model.resolvedMdoc.footer?.right ?? ""}
          onChange={(e) =>
            patchMdoc({ ...mdoc, footer: { ...mdoc.footer, right: e.target.value } })
          }
        />
      </label>
      <label className="mb-3 mt-2 flex min-h-11 items-center gap-2">
        <input
          type="checkbox"
          checked={Boolean(model.resolvedMdoc.toc?.enabled)}
          onChange={() =>
            patchMdoc({
              ...mdoc,
              toc: { enabled: !model.resolvedMdoc.toc?.enabled, depth: 3 }
            })
          }
        />
        Include table of contents in PDF/HTML export
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

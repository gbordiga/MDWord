"use client";

import { cn } from "@mdword/ui";
import { BUILT_IN_TEMPLATES } from "@mdword/layout-engine";
import { documentTitle, documentTitleKey } from "@mdword/shared";
import { useApp } from "@/lib/store";

const fieldClass =
  "mt-1 w-full rounded-md border border-[#e4e7ec] px-3 py-2 text-[16px] lg:px-2 lg:py-1 lg:text-[13px]";

const RUNNING_FIELDS = [
  { group: "header", field: "left", label: "Header left" },
  { group: "header", field: "center", label: "Header center" },
  { group: "header", field: "right", label: "Header right" },
  { group: "footer", field: "left", label: "Footer left" },
  { group: "footer", field: "center", label: "Footer center" },
  { group: "footer", field: "right", label: "Footer right" }
] as const;

export function PropertiesPanel({ className }: { className?: string }) {
  const model = useApp((s) => s.model);
  const patchFrontmatter = useApp((s) => s.patchFrontmatter);
  const patchMdoc = useApp((s) => s.patchMdoc);
  const mdoc = model.mdoc;
  const titleKey = documentTitleKey(model.frontmatter);
  const margins = model.resolvedMdoc.margins ?? {};
  const pageSize =
    typeof model.resolvedMdoc.page?.size === "string" ? model.resolvedMdoc.page.size : "A4";
  const templateId = mdoc.template ?? "normal";
  const template = BUILT_IN_TEMPLATES.find((t) => t.id === templateId);
  const tocEnabled = Boolean(model.resolvedMdoc.toc?.enabled);
  const tocDepth = model.resolvedMdoc.toc?.depth ?? 3;

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
          data-testid="prop-template"
          className={fieldClass}
          value={templateId}
          onChange={(e) => patchMdoc({ ...mdoc, template: e.target.value })}
        >
          {BUILT_IN_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      {template ? (
        <p className="mb-3 text-[12px] leading-snug text-[#667085]" data-testid="prop-template-hint">
          {template.description}
        </p>
      ) : null}
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
      <h2 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
        Header and footer
      </h2>
      <p className="mb-2 text-[12px] text-[#667085]">
        Same fields are used on the page and in PDF/HTML export. Use {"{{page}}"} and {"{{pages}}"} for page
        numbers.
      </p>
      {RUNNING_FIELDS.map(({ group, field, label }) => (
        <label key={`${group}-${field}`} className="mb-2 block">
          {label}
          <input
            data-testid={`prop-${group}-${field}`}
            className={fieldClass}
            value={mdoc[group]?.[field] ?? model.resolvedMdoc[group]?.[field] ?? ""}
            onChange={(e) =>
              patchMdoc({
                ...mdoc,
                [group]: {
                  ...model.resolvedMdoc[group],
                  ...mdoc[group],
                  [field]: e.target.value
                }
              })
            }
          />
        </label>
      ))}
      <h2 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
        Table of contents
      </h2>
      <label className="mb-3 mt-2 flex min-h-11 items-center gap-2">
        <input
          type="checkbox"
          data-testid="prop-toc"
          checked={tocEnabled}
          onChange={() =>
            patchMdoc({
              ...mdoc,
              toc: { enabled: !tocEnabled, depth: tocDepth }
            })
          }
        />
        Show a live table of contents (updates from headings)
      </label>
      {tocEnabled ? (
        <label className="mb-3 block">
          Heading depth
          <select
            className={fieldClass}
            value={tocDepth}
            onChange={(e) =>
              patchMdoc({
                ...mdoc,
                toc: { enabled: true, depth: Number(e.target.value) }
              })
            }
          >
            {[1, 2, 3, 4, 5, 6].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {model.diagnostics.length > 0 && (
        <div className="mt-4 rounded-md bg-[#fffbeb] p-2 text-[12px] text-[#92400e]" data-testid="diagnostics">
          {model.diagnostics.slice(0, 6).map((d, i) => (
            <div key={i}>{d.message}</div>
          ))}
        </div>
      )}
    </aside>
  );
}

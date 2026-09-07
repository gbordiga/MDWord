"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@mdword/ui";
import { BUILT_IN_TEMPLATES, FONT_SCALES, matchFontScale, matchMarginPreset } from "@mdword/layout-engine";
import { documentDate, documentTitle, documentTitleKey } from "@mdword/shared";
import { useApp } from "@/lib/store";
import { MarginEditor } from "./MarginEditor";

const fieldClass =
  "mt-1 w-full rounded-md border border-[#e4e7ec] bg-white px-3 py-2 text-[16px] lg:px-2 lg:py-1.5 lg:text-[13px]";

const RUNNING_FIELDS = [
  { group: "header", field: "left", label: "Left" },
  { group: "header", field: "center", label: "Center" },
  { group: "header", field: "right", label: "Right" },
  { group: "footer", field: "left", label: "Left" },
  { group: "footer", field: "center", label: "Center" },
  { group: "footer", field: "right", label: "Right" }
] as const;

function PropertySection({
  id,
  title,
  hint,
  defaultOpen,
  children
}: {
  id: string;
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      data-testid={`prop-section-${id}`}
      className="group border-b border-[#e4e7ec] last:border-b-0"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 hover:bg-[#f8fafc] [&::-webkit-details-marker]:hidden">
        <ChevronDown
          size={14}
          aria-hidden
          className="shrink-0 text-[#98a2b3] transition-transform duration-150 group-open:rotate-180"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-semibold text-[#1c1f24]">{title}</span>
          {hint ? (
            <span className="mt-0.5 block truncate text-[11px] text-[#667085] group-open:hidden">{hint}</span>
          ) : null}
        </span>
      </summary>
      <div className="space-y-2.5 px-3 pb-3">{children}</div>
    </details>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-[11px] font-medium text-[#667085]">
      {label}
      {children}
    </label>
  );
}

export function PropertiesPanel({ className }: { className?: string }) {
  const model = useApp((s) => s.model);
  const patchFrontmatter = useApp((s) => s.patchFrontmatter);
  const patchMdoc = useApp((s) => s.patchMdoc);
  const mdoc = model.mdoc;
  const titleKey = documentTitleKey(model.frontmatter);
  const title = documentTitle(model.frontmatter, "");
  const pageSize =
    typeof model.resolvedMdoc.page?.size === "string" ? model.resolvedMdoc.page.size : "A4";
  const orientation = model.resolvedMdoc.page?.orientation ?? "portrait";
  const templateId = mdoc.template ?? "normal";
  const template = BUILT_IN_TEMPLATES.find((t) => t.id === templateId);
  const tocEnabled = Boolean(model.resolvedMdoc.toc?.enabled);
  const tocDepth = model.resolvedMdoc.toc?.depth ?? 3;
  const marginPreset = matchMarginPreset(model.resolvedMdoc.margins);
  const fontScale = matchFontScale(model.resolvedMdoc);
  const fontScaleName =
    fontScale === "custom" ? "Custom" : (FONT_SCALES.find((s) => s.id === fontScale)?.name ?? "Medium");
  const headerPreview = [mdoc.header?.left, mdoc.header?.center, mdoc.header?.right]
    .map((value) => value ?? "")
    .find((value) => value.trim())
    ?.trim();

  return (
    <aside
      className={cn("flex h-full w-full min-w-0 flex-col border-l border-[#e4e7ec] bg-white text-[13px]", className)}
    >
      <div className="shrink-0 border-b border-[#e4e7ec] px-3 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[#667085]">Properties</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <PropertySection
          id="document"
          title="Document"
          hint={`${title || "Untitled"} · ${fontScaleName}`}
          defaultOpen
        >
          <Field label="Title">
            <input
              data-testid="prop-title"
              className={fieldClass}
              value={title}
              onChange={(e) => patchFrontmatter({ [titleKey]: e.target.value })}
            />
          </Field>
          <Field label="Subtitle">
            <input
              className={fieldClass}
              value={String(model.frontmatter.subtitle ?? "")}
              onChange={(e) => patchFrontmatter({ subtitle: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Date">
              <input
                data-testid="prop-date"
                className={fieldClass}
                value={documentDate(model.frontmatter)}
                onChange={(e) => patchFrontmatter({ date: e.target.value })}
              />
            </Field>
            <Field label="Language">
              <input
                className={fieldClass}
                value={String(model.frontmatter.language ?? "it")}
                onChange={(e) => patchFrontmatter({ language: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Font size">
            <select
              aria-label="Font size"
              data-testid="prop-font-scale"
              className={fieldClass}
              value={fontScale}
              onChange={(e) => {
                const id = e.target.value;
                if (id === "custom") return;
                patchMdoc({
                  ...mdoc,
                  fontScale: id as (typeof FONT_SCALES)[number]["id"]
                });
              }}
            >
              {FONT_SCALES.map((scale) => (
                <option key={scale.id} value={scale.id} title={scale.description}>
                  {scale.name}
                </option>
              ))}
              {fontScale === "custom" ? <option value="custom">Custom</option> : null}
            </select>
          </Field>
          <p className="text-[12px] leading-snug text-[#667085]">
            Scales body text, titles and headings.{" "}
            {fontScale === "custom"
              ? "This document uses custom point sizes."
              : (FONT_SCALES.find((s) => s.id === fontScale)?.description ?? "")}
          </p>
        </PropertySection>

        <PropertySection
          id="page"
          title="Page"
          hint={`${pageSize} · ${orientation === "landscape" ? "Landscape" : "Portrait"} · ${template?.name ?? templateId}`}
          defaultOpen
        >
          <div className="grid grid-cols-2 gap-2">
            <Field label="Size">
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
            </Field>
            <Field label="Orientation">
              <select
                className={fieldClass}
                value={orientation}
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
            </Field>
          </div>
          <Field label="Template">
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
          </Field>
          {template ? (
            <p className="text-[12px] leading-snug text-[#667085]" data-testid="prop-template-hint">
              {template.description}
            </p>
          ) : null}
        </PropertySection>

        <PropertySection
          id="margins"
          title="Margins"
          hint={marginPreset === "custom" ? "Custom" : `${marginPreset.charAt(0).toUpperCase()}${marginPreset.slice(1)}`}
        >
          <MarginEditor
            mdoc={mdoc}
            resolved={model.resolvedMdoc}
            onChange={(margins) => patchMdoc({ ...mdoc, margins })}
          />
        </PropertySection>

        <PropertySection id="running" title="Header and footer" hint={headerPreview || "Page numbers and title"}>
          <p className="text-[12px] leading-snug text-[#667085]">
            Used on the page and in PDF/HTML export. Tokens: {"{{page}}"}, {"{{pages}}"}, {"{{title}}"}, {"{{date}}"}.
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#667085]">Header</p>
          <div className="grid grid-cols-1 gap-2">
            {RUNNING_FIELDS.filter((f) => f.group === "header").map(({ group, field, label }) => (
              <Field key={`${group}-${field}`} label={label}>
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
              </Field>
            ))}
          </div>
          <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-[#667085]">Footer</p>
          <div className="grid grid-cols-1 gap-2">
            {RUNNING_FIELDS.filter((f) => f.group === "footer").map(({ group, field, label }) => (
              <Field key={`${group}-${field}`} label={label}>
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
              </Field>
            ))}
          </div>
        </PropertySection>

        <PropertySection id="toc" title="Table of contents" hint={tocEnabled ? `On · depth ${tocDepth}` : "Off"}>
          <label className="flex min-h-11 items-start gap-2 text-[13px] text-[#1c1f24]">
            <input
              type="checkbox"
              data-testid="prop-toc"
              className="mt-1"
              checked={tocEnabled}
              onChange={() =>
                patchMdoc({
                  ...mdoc,
                  toc: { enabled: !tocEnabled, depth: tocDepth }
                })
              }
            />
            Show a live table of contents from headings
          </label>
          {tocEnabled ? (
            <Field label="Heading depth">
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
            </Field>
          ) : null}
        </PropertySection>

        {model.diagnostics.length > 0 ? (
          <div className="m-3 rounded-md bg-[#fffbeb] p-2 text-[12px] text-[#92400e]" data-testid="diagnostics">
            {model.diagnostics.slice(0, 6).map((d, i) => (
              <div key={i}>{d.message}</div>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

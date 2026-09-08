"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { FONT_SCALES, matchFontScale, matchMarginPreset } from "@mdword/layout-engine";
import { documentDate, documentTitle, documentTitleKey } from "@mdword/shared";
import { IMAGE_LAYOUTS, widthForLayoutChange, type ImageLayout } from "@mdword/editor";
import { useApp } from "@/lib/store";
import { useEditorUi } from "@/lib/editorUi";
import { useEditorTick } from "@/hooks/useEditorTick";
import { FrontmatterEditor } from "./FrontmatterEditor";
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
  testIds,
  children
}: {
  id: string;
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  testIds?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      data-testid={testIds ? `prop-section-${id}` : undefined}
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

export function DocumentProperties({
  variant
}: {
  variant: "panel" | "inline";
}) {
  const model = useApp((s) => s.model);
  const patchFrontmatter = useApp((s) => s.patchFrontmatter);
  const patchMdoc = useApp((s) => s.patchMdoc);
  const titleKey = documentTitleKey(model.frontmatter);
  const title = documentTitle(model.frontmatter, "");
  const dateKey =
    model.frontmatter.data != null && model.frontmatter.data !== "" && model.frontmatter.date == null
      ? "data"
      : "date";
  const languageKey =
    typeof model.frontmatter.lingua === "string" &&
    model.frontmatter.lingua &&
    !model.frontmatter.language
      ? "lingua"
      : "language";
  const mdoc = model.mdoc;
  const pageSize =
    typeof model.resolvedMdoc.page?.size === "string" ? model.resolvedMdoc.page.size : "A4";
  const orientation = model.resolvedMdoc.page?.orientation ?? "portrait";
  const tocEnabled = Boolean(model.resolvedMdoc.toc?.enabled);
  const tocDepth = model.resolvedMdoc.toc?.depth ?? 3;
  const marginPreset = matchMarginPreset(model.resolvedMdoc.margins);
  const fontScale = matchFontScale(model.resolvedMdoc);
  const headerPreview = [mdoc.header?.left, mdoc.header?.center, mdoc.header?.right]
    .map((value) => value ?? "")
    .find((value) => value.trim())
    ?.trim();
  const testIds = variant === "panel";

  const { editor } = useEditorUi();
  useEditorTick(editor);
  const inImage = Boolean(editor?.isActive("figure"));
  const imageAttrs = editor?.getAttributes("figure") ?? {};
  const imageLayout = IMAGE_LAYOUTS.includes(imageAttrs.layout as ImageLayout)
    ? (imageAttrs.layout as ImageLayout)
    : "block-center";
  const imageWidth = Number(imageAttrs.width ?? 100);

  return (
    <div>
      {inImage && editor ? (
        <PropertySection
          id="image"
          title="Image"
          hint={`${imageWidth}% · ${imageLayout.replace("-", " ")}`}
          defaultOpen
          testIds={testIds}
        >
          <Field label="Position">
            <select
              data-testid={testIds ? "prop-image-layout" : undefined}
              className={fieldClass}
              value={imageLayout}
              onChange={(e) => {
                const next = e.target.value as ImageLayout;
                editor
                  .chain()
                  .focus()
                  .updateFigure({ layout: next, width: widthForLayoutChange(imageWidth, next) })
                  .run();
              }}
            >
              <option value="block-left">Left</option>
              <option value="block-center">Center</option>
              <option value="block-right">Right</option>
              <option value="float-left">Float left</option>
              <option value="float-right">Float right</option>
            </select>
          </Field>
          <Field label="Width (%)">
            <input
              data-testid={testIds ? "prop-image-width" : undefined}
              className={fieldClass}
              type="number"
              min={10}
              max={100}
              value={imageWidth}
              onChange={(e) => editor.chain().focus().updateFigure({ width: Number(e.target.value) }).run()}
            />
          </Field>
          <Field label="Alternative text">
            <input
              data-testid={testIds ? "prop-image-alt" : undefined}
              className={fieldClass}
              value={String(imageAttrs.alt ?? "")}
              onChange={(e) => editor.chain().focus().updateFigure({ alt: e.target.value }).run()}
            />
          </Field>
        </PropertySection>
      ) : null}
      <p className="px-3 pb-2 pt-1 text-[12px] leading-snug text-[#667085]">
        Saved in this document. Fields, page, margins, header, footer and contents all travel with the
        file.
      </p>
      <PropertySection
        id="document"
        title="Document"
        hint={title || "Untitled"}
        defaultOpen
        testIds={testIds}
      >
        <Field label="Title">
          <input
            data-testid={testIds ? "prop-title" : "fm-value-title"}
            className={fieldClass}
            value={title}
            onChange={(e) => patchFrontmatter({ [titleKey]: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Date">
            <input
              data-testid={testIds ? "prop-date" : "fm-value-date"}
              className={fieldClass}
              type="date"
              value={documentDate(model.frontmatter)}
              onChange={(e) => patchFrontmatter({ [dateKey]: e.target.value })}
            />
          </Field>
          <Field label="Language">
            <input
              className={fieldClass}
              value={String(model.frontmatter[languageKey] ?? "it")}
              onChange={(e) => patchFrontmatter({ [languageKey]: e.target.value })}
            />
          </Field>
        </div>
      </PropertySection>

      <PropertySection
        id="custom"
        title="Custom properties"
        hint="Extra fields stored with this file"
        defaultOpen={variant === "inline" ? true : undefined}
        testIds={testIds}
      >
        <FrontmatterEditor compact={variant === "panel"} testIdScope={variant} />
      </PropertySection>

      <PropertySection
        id="page"
        title="Page"
        hint={`${pageSize} · ${orientation === "landscape" ? "Landscape" : "Portrait"}`}
        defaultOpen
        testIds={testIds}
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
        <Field label="Font size">
          <select
            aria-label="Font size"
            data-testid={testIds ? "prop-font-scale" : undefined}
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
      </PropertySection>

      <PropertySection
        id="margins"
        title="Margins"
        hint={marginPreset === "custom" ? "Custom" : `${marginPreset.charAt(0).toUpperCase()}${marginPreset.slice(1)}`}
        testIds={testIds}
      >
        <MarginEditor
          mdoc={mdoc}
          resolved={model.resolvedMdoc}
          onChange={(margins) => patchMdoc({ ...mdoc, margins })}
        />
      </PropertySection>

      <PropertySection id="running" title="Header and footer" hint={headerPreview || "Page numbers and title"} testIds={testIds}>
        <p className="text-[12px] leading-snug text-[#667085]">
          Shown on each page and in PDF. Tokens: {"{{page}}"}, {"{{pages}}"}, {"{{title}}"}, {"{{date}}"}.
        </p>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#667085]">Header</p>
        <div className="grid grid-cols-1 gap-2">
          {RUNNING_FIELDS.filter((f) => f.group === "header").map(({ group, field, label }) => (
            <Field key={`${group}-${field}`} label={label}>
              <input
                data-testid={testIds ? `prop-${group}-${field}` : undefined}
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
                data-testid={testIds ? `prop-${group}-${field}` : undefined}
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

      <PropertySection id="toc" title="Table of contents" hint={tocEnabled ? `On · depth ${tocDepth}` : "Off"} testIds={testIds}>
        <label className="flex min-h-11 items-start gap-2 text-[13px] text-[#1c1f24]">
          <input
            type="checkbox"
            data-testid={testIds ? "prop-toc" : undefined}
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
    </div>
  );
}

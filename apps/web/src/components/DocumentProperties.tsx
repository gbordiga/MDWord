"use client";

import type { ReactNode } from "react";
import { AlertTriangle, ChevronDown, FileText, Frame, ListTree, PanelTop, Ruler, Tags, type LucideIcon } from "lucide-react";
import { FONT_SCALES, matchFontScale, matchMarginPreset } from "@mdword/layout-engine";
import { documentDate, documentTitle, documentTitleKey } from "@mdword/shared";
import { listCustomFrontmatterKeys } from "@mdword/document-model";
import { useApp } from "@/lib/store";
import { FrontmatterEditor } from "./FrontmatterEditor";
import { MarginEditor } from "./MarginEditor";

import { Check, Field, InfoHint, fieldClass } from "./propertyUi";

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
  icon: Icon,
  tip,
  hint,
  defaultOpen,
  testIds,
  children
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  /** What the section does, shown in a tooltip instead of on the page. */
  tip?: string;
  /** Current value, shown on the closed header. */
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
      <summary className="flex cursor-pointer list-none items-center gap-2 border-b border-transparent bg-[#f2f4f7] px-3 py-2 transition-colors hover:bg-[#eaecf0] group-open:border-[#e4e7ec] [&::-webkit-details-marker]:hidden">
        <Icon size={14} aria-hidden className="shrink-0 text-[#667085]" />
        <span className="text-[12px] font-semibold text-[#1c1f24]">{title}</span>
        {tip ? <InfoHint text={tip} /> : null}
        <span className="ml-auto flex min-w-0 items-center gap-1.5">
          {hint ? (
            <span className="min-w-0 truncate text-[11px] font-normal text-[#667085] group-open:hidden">{hint}</span>
          ) : null}
          <ChevronDown
            size={14}
            aria-hidden
            className="shrink-0 text-[#98a2b3] transition-transform duration-150 group-open:rotate-180"
          />
        </span>
      </summary>
      <div className="space-y-3 px-3 py-3">{children}</div>
    </details>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="border-b border-[#e4e7ec] bg-white px-3 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wider text-[#98a2b3]">
      {children}
    </p>
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

  return (
    <div>
      {variant === "panel" && model.diagnostics.length > 0 ? (
        <PropertySection
          id="diagnostics"
          title="Diagnostics"
          icon={AlertTriangle}
          hint={`${model.diagnostics.length} ${model.diagnostics.length === 1 ? "issue" : "issues"}`}
          defaultOpen
          testIds
        >
          <div data-testid="diagnostics" className="space-y-1.5">
            {model.diagnostics.map((d, i) => (
              <div
                key={`${d.code ?? "diag"}-${i}`}
                className={
                  d.severity === "error"
                    ? "rounded-md bg-[#fef3f2] px-2 py-1.5 text-[12px] text-[#b42318]"
                    : d.severity === "info"
                      ? "rounded-md bg-[#f2f4f7] px-2 py-1.5 text-[12px] text-[#344054]"
                      : "rounded-md bg-[#fffbeb] px-2 py-1.5 text-[12px] text-[#92400e]"
                }
              >
                {d.message}
              </div>
            ))}
          </div>
        </PropertySection>
      ) : null}
      <GroupLabel>Content</GroupLabel>
      <PropertySection
        id="document"
        title="Document"
        icon={FileText}
        tip="Saved in this document. Fields, page, margins, header, footer and contents all travel with the file."
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
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-[#f9fafb] px-2.5 py-0.5">
          <Check
            label="Show title"
            hint="Show the title at the top of the document."
            testId={testIds ? "prop-show-title" : "fm-show-title"}
            checked={Boolean(model.resolvedMdoc.masthead?.title)}
            onChange={(checked) =>
              patchMdoc({ ...mdoc, masthead: { ...model.resolvedMdoc.masthead, title: checked } })
            }
          />
          <Check
            label="Show date"
            hint="Show the date under the title."
            testId={testIds ? "prop-show-date" : "fm-show-date"}
            checked={Boolean(model.resolvedMdoc.masthead?.date)}
            onChange={(checked) =>
              patchMdoc({ ...mdoc, masthead: { ...model.resolvedMdoc.masthead, date: checked } })
            }
          />
        </div>
      </PropertySection>
      <PropertySection id="toc" title="Table of contents" icon={ListTree} tip="A live table of contents built from the headings." hint={tocEnabled ? `On · depth ${tocDepth}` : "Off"} testIds={testIds}>
        <Check
          label="Show table of contents"
          hint="Builds a live table of contents from the headings."
          testId={testIds ? "prop-toc" : undefined}
          checked={tocEnabled}
          onChange={() => patchMdoc({ ...mdoc, toc: { enabled: !tocEnabled, depth: tocDepth } })}
        />
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
      <PropertySection
        id="custom"
        title="Custom properties"
        icon={Tags}
        tip="Extra fields stored in the file's front matter."
        hint={`${listCustomFrontmatterKeys(model).length || "None"}`}
        defaultOpen={variant === "inline" ? true : undefined}
        testIds={testIds}
      >
        <FrontmatterEditor compact={variant === "panel"} testIdScope={variant} />
      </PropertySection>
      <GroupLabel>Page layout</GroupLabel>
      <PropertySection
        id="page"
        title="Page"
        icon={Frame}
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
            <div role="radiogroup" aria-label="Orientation" className="flex rounded-lg border border-[#d0d5dd] bg-white p-0.5">
              {(["portrait", "landscape"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={orientation === value}
                  aria-label={value === "portrait" ? "Portrait" : "Landscape"}
                  title={value === "portrait" ? "Portrait" : "Landscape"}
                  data-testid={testIds ? `prop-orientation-${value}` : undefined}
                  className={`flex h-8 flex-1 items-center justify-center rounded-md transition-colors lg:h-7 ${
                    orientation === value ? "bg-accent text-white" : "text-[#667085] hover:bg-[#f2f4f7]"
                  }`}
                  onClick={() => patchMdoc({ ...mdoc, page: { ...mdoc.page, orientation: value } })}
                >
                  <span
                    aria-hidden
                    className={`block rounded-[2px] border-[1.5px] border-current ${value === "portrait" ? "h-3.5 w-2.5" : "h-2.5 w-3.5"}`}
                  />
                </button>
              ))}
            </div>
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
        icon={Ruler}
        tip="Drag the markers on the rulers, or type millimetres."
        hint={marginPreset === "custom" ? "Custom" : `${marginPreset.charAt(0).toUpperCase()}${marginPreset.slice(1)}`}
        testIds={testIds}
      >
        <MarginEditor
          mdoc={mdoc}
          resolved={model.resolvedMdoc}
          onChange={(margins) => patchMdoc({ ...mdoc, margins })}
        />
      </PropertySection>
      <PropertySection id="running" title="Header and footer" icon={PanelTop} tip="Shown on each page and in PDF. Tokens: {{page}}, {{pages}}, {{title}}, {{date}}." hint={headerPreview || "Page numbers and title"} testIds={testIds}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#667085]">Header</p>
        <div className="grid grid-cols-3 gap-1.5">
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
        <p className="border-t border-[#eaecf0] pt-3 text-[11px] font-semibold uppercase tracking-wide text-[#667085]">Footer</p>
        <div className="grid grid-cols-3 gap-1.5">
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
    </div>
  );
}

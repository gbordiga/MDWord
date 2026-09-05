import type { Mdoc } from "./schema";

export interface BuiltInTemplate {
  id: string;
  name: string;
  description: string;
  mdoc: Mdoc;
}

const report: Mdoc = {
  version: 1,
  page: { size: "A4", orientation: "portrait" },
  margins: { top: "25mm", right: "20mm", bottom: "25mm", left: "25mm" },
  header: { left: "{{title}}", center: "", right: "{{page}} / {{pages}}" },
  footer: { left: "", center: "{{date}}", right: "" },
  numbering: { headings: true, figures: true, tables: true },
  toc: { enabled: true, depth: 3 },
  typography: {
    body: { "font-size": "11pt", "line-height": 1.2 },
    "heading-1": { "font-size": "18pt", weight: 700 }
  }
};

export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  {
    id: "normal",
    name: "Normal",
    description: "Clean default document",
    mdoc: { version: 1 }
  },
  {
    id: "report",
    name: "Report",
    description: "Numbered headings, TOC, headers",
    mdoc: report
  },
  {
    id: "technical-report",
    name: "Technical Report",
    description: "Dense technical layout",
    mdoc: {
      ...report,
      typography: {
        body: { "font-size": "10pt", "line-height": 1.25 },
        "heading-1": { "font-size": "16pt", weight: 700 }
      }
    }
  },
  {
    id: "letter",
    name: "Letter",
    description: "Correspondence",
    mdoc: {
      version: 1,
      page: { size: "A4", orientation: "portrait" },
      margins: { top: "25mm", right: "25mm", bottom: "25mm", left: "25mm" },
      header: { left: "", center: "", right: "" },
      footer: { left: "", center: "", right: "" },
      toc: { enabled: false }
    }
  },
  {
    id: "meeting-minutes",
    name: "Meeting Minutes",
    description: "Agenda and notes",
    mdoc: {
      version: 1,
      header: { left: "{{title}}", center: "", right: "{{date}}" },
      footer: { left: "", center: "", right: "{{page}}" },
      numbering: { headings: false }
    }
  },
  {
    id: "procedure",
    name: "Procedure",
    description: "Controlled procedure",
    mdoc: {
      ...report,
      header: { left: "{{title}}", center: "PROCEDURE", right: "{{page}} / {{pages}}" }
    }
  },
  {
    id: "manual",
    name: "Manual",
    description: "Long-form manual",
    mdoc: {
      ...report,
      toc: { enabled: true, depth: 4 },
      numbering: { headings: true, figures: true, tables: true }
    }
  }
];

export function getTemplate(id: string | undefined): BuiltInTemplate | undefined {
  if (!id) return undefined;
  return BUILT_IN_TEMPLATES.find((t) => t.id === id);
}

/** Copy resolved template fields onto document mdoc for portability. */
export function embedTemplate(document: Mdoc, template: Mdoc): Mdoc {
  const { template: _ignored, ...rest } = template;
  return { ...document, ...rest, version: document.version ?? 1 };
}

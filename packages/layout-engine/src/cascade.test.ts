import { describe, expect, it } from "vitest";
import {
  APPLICATION_DEFAULTS,
  resolveMdoc,
  parseMdoc,
  pageMetrics,
  countFlowPages,
  resolveVariables,
  resolveRunningForPrint,
  resolveRunningForPreview,
  getTemplate,
  embedTemplate
} from "./index";

describe("mdoc schema", () => {
  it("accepts the example frontmatter subset", () => {
    const { value, issues } = parseMdoc({
      version: 1,
      template: "report",
      page: { size: "A4", orientation: "portrait" },
      margins: { top: "20mm", right: "20mm", bottom: "20mm", left: "25mm" }
    });
    expect(issues).toEqual([]);
    expect(value.page?.size).toBe("A4");
  });

  it("rejects raw CSS-like invalid lengths", () => {
    const { issues } = parseMdoc({ margins: { top: "20px" } });
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe("cascade", () => {
  it("lets document override template, template override app", () => {
    const resolved = resolveMdoc({
      application: APPLICATION_DEFAULTS,
      template: getTemplate("report")!.mdoc,
      document: { version: 1, margins: { left: "30mm" } }
    });
    expect(resolved.margins?.left).toBe("30mm");
    expect(resolved.numbering?.headings).toBe(true);
  });

  it("applies a named font scale over template point sizes", () => {
    const resolved = resolveMdoc({
      application: APPLICATION_DEFAULTS,
      template: getTemplate("technical-report")!.mdoc,
      document: { version: 1, fontScale: "large" }
    });
    expect(resolved.typography?.body?.["font-size"]).toBe("13pt");
    expect(resolved.typography?.["heading-1"]?.["font-size"]).toBe("24pt");
    expect(resolved.typography?.title?.["font-size"]).toBe("32pt");
  });
});

describe("variables", () => {
  it("substitutes known variables and blanks unknown", () => {
    expect(
      resolveVariables("{{title}} — {{page}} / {{pages}} {{unknown}}", {
        title: "Audit",
        page: 2,
        pages: 10
      })
    ).toBe("Audit — 2 / 10 ");
  });

  it("keeps page tokens for print and uses an ellipsis in preview", () => {
    const ctx = { title: "Audit", date: "2026-01-01", page: 1, pages: 1 };
    expect(resolveRunningForPrint("{{title}} · {{page}} / {{pages}}", ctx)).toBe(
      "Audit · {{page}} / {{pages}}"
    );
    expect(resolveRunningForPreview("{{page}} / {{pages}}", ctx)).toBe("1 / 1");
    expect(resolveRunningForPreview("{{page}} / {{pages}}", { ...ctx, pages: undefined })).toBe("1 / …");
  });
});

describe("page metrics", () => {
  it("computes A4 portrait and landscape", () => {
    const portrait = pageMetrics({
      version: 1,
      page: { size: "A4", orientation: "portrait" }
    });
    expect(portrait.widthMm).toBe(210);
    const landscape = pageMetrics({
      version: 1,
      page: { size: "A4", orientation: "landscape" }
    });
    expect(landscape.widthMm).toBe(297);
  });
});

describe("page flow", () => {
  it("counts stacked pages from content height", () => {
    expect(countFlowPages(100, 400)).toBe(1);
    expect(countFlowPages(400, 400)).toBe(1);
    expect(countFlowPages(401, 400)).toBe(2);
    expect(countFlowPages(0, 400)).toBe(1);
  });
});

describe("embed template", () => {
  it("copies template fields into the document", () => {
    const embedded = embedTemplate({ version: 1, template: "report" }, getTemplate("report")!.mdoc);
    expect(embedded.toc?.enabled).toBe(true);
    expect(embedded.template).toBe("report");
  });
});

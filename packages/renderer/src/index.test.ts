import { describe, expect, it } from "vitest";
import { astToHtml } from "./index";

describe("renderer security", () => {
  it("strips script tags from injected HTML nodes", () => {
    const html = astToHtml({
      type: "root",
      children: [
        { type: "paragraph", children: [{ type: "text", value: "<script>alert(1)</script>" }] },
        {
          type: "html",
          value: '<script>alert(1)</script><img src="x" onerror="alert(1)" />'
        }
      ]
    });
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<img[^>]+onerror/i);
  });
});

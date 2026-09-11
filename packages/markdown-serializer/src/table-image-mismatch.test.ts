import { describe, expect, it } from "vitest";
import { imageReference } from "@mdword/shared";
import { parseMarkdown } from "@mdword/myst-parser";
import { serializeMarkdown } from "./serialize";
import { astToTiptap } from "../../editor/src/astToTiptap";
import { tiptapToAst } from "../../editor/src/tiptapToAst";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("mismatched image tables", () => {
  it("keeps a 4-image header when the delimiter only has 3 columns", () => {
    const src = `![poster][img-bd7465d126c93]| ![][img-bd7465d126c93] | ![][img-bd7465d126c93] | ![][img-bd7465d126c93] |
| ------------------------------------- | ------------------------------------- | ------------------------------------- |
|                                       |                                       |                                       |
|                                       |                                       |                                       |

[img-bd7465d126c93]: ${PNG}
`;
    const parsed = parseMarkdown(src);
    expect(parsed.ast.children?.[0]?.type).toBe("table");
    const out = serializeMarkdown({ ast: parsed.ast });
    expect(out).not.toContain("\\|");
    expect(out).toContain(imageReference("poster", PNG).image);
    expect(out.split("\n")[0]).toMatch(/^\|/);
    const json = astToTiptap(parsed.ast);
    expect(json.content?.[0]?.type).toBe("table");
    expect(json.content?.[0]?.content?.[0]?.content?.length).toBe(4);
    const back = serializeMarkdown({ ast: tiptapToAst(json) });
    expect(back).not.toContain("\\|");
    expect(back).toMatch(/\|.*!\[poster\]\[img-/);
  });

  it("reloads a file that was already saved with escaped table pipes", () => {
    const src = `![poster][img-bd7465d126c93]| ![][img-bd7465d126c93] | ![][img-bd7465d126c93] | ![][img-bd7465d126c93] |
\\| ------------------------------------- | ------------------------------------- | ------------------------------------- |
\\|                                       |                                       |                                       |

[img-bd7465d126c93]: ${PNG}
`;
    const parsed = parseMarkdown(src);
    expect(parsed.ast.children?.[0]?.type).toBe("table");
    expect(serializeMarkdown({ ast: parsed.ast })).not.toContain("\\|");
  });
});

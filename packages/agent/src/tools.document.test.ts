import { describe, expect, it, vi } from "vitest";
import { createTools, type ToolContext } from "./tools";
import type { AssistantEnv } from "./types";

function setup(markdown: string | null = "# Notes") {
  const readDocument = vi.fn(async () => markdown);
  const env = {
    listFiles: async () => [],
    search: async () => [],
    readFile: async () => null,
    readDocument,
    diagnostics: () => [],
    canCreateFiles: () => true,
    proposeEdit: async () => ({ status: "rejected" as const }),
    proposeDelete: async () => ({ status: "rejected" as const })
  } satisfies AssistantEnv;
  const ctx: ToolContext = { env, maxToolChars: 1e9, toolChars: 0, stopReason: null };
  return { tools: createTools(ctx), readDocument };
}

type Exec = (input: unknown, options: unknown) => Promise<Record<string, unknown>>;
const exec = (t: unknown, input: unknown) => (t as { execute: Exec }).execute(input, { toolCallId: "x", messages: [] });

describe("readDocument", () => {
  it("returns markdown for a file inside the project", async () => {
    const { tools, readDocument } = setup("# From the deck");
    expect(await exec(tools.readDocument, { path: "slides.pptx" })).toMatchObject({
      ok: true,
      markdown: "# From the deck"
    });
    expect(readDocument).toHaveBeenCalledWith("slides.pptx");
  });

  it("refuses a path outside the project and a markdown file", async () => {
    const { tools, readDocument } = setup();
    expect(await exec(tools.readDocument, { path: "../secret.docx" })).toMatchObject({ ok: false });
    expect(await exec(tools.readDocument, { path: "notes.md" })).toMatchObject({ ok: false });
    expect(readDocument).not.toHaveBeenCalled();
  });

  it("sends office files away from readFile", async () => {
    const { tools } = setup();
    expect(await exec(tools.readFile, { path: "report.pdf" })).toMatchObject({ ok: false });
  });

  it("hides image bytes when reading and keeps them when saving a conversion", async () => {
    const payload = "data:image/png;base64," + "A".repeat(300);
    const source = `![Logo][img-1]\n\n[img-1]: ${payload}`;
    let saved = "";
    const { tools } = setup(source);
    const read = await exec(tools.readDocument, { path: "page.html" });
    expect(String(read.markdown)).toContain("omitted");
    expect(String(read.markdown)).not.toContain(payload);
    const converting = createTools({
      env: {
        listFiles: async () => [],
        search: async () => [],
        readFile: async () => null,
        readDocument: async () => source,
        diagnostics: () => [],
        canCreateFiles: () => true,
        proposeEdit: async (proposal) => {
          saved = proposal.after;
          return { status: "applied" };
        },
        proposeDelete: async () => ({ status: "rejected" })
      },
      maxToolChars: 1e9,
      toolChars: 0,
      stopReason: null
    });
    const out = await exec(converting.readDocument, { path: "page.html", saveAs: "page.md" });
    expect(out).toMatchObject({ ok: true, status: "applied", path: "page.md" });
    expect(saved).toContain(payload);
  });
});

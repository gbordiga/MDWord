import { describe, expect, it } from "vitest";
import { WEB_SEARCH_TOOL, withWebSearch } from "./openrouter";
import { buildContext, buildSystemPrompt, SYSTEM_PROMPT } from "./prompt";

function recorder() {
  const calls: { input: unknown; init?: RequestInit }[] = [];
  const base = (async (input: unknown, init?: RequestInit) => {
    calls.push({ input, init });
    return new Response("{}");
  }) as unknown as typeof fetch;
  return { calls, base };
}

describe("web search tool injection", () => {
  it("adds the server tool next to the function tools", async () => {
    const { calls, base } = recorder();
    const body = { model: "m", tools: [{ type: "function", function: { name: "readFile" } }] };
    await withWebSearch(base)("https://openrouter.ai/api/v1/chat/completions", { method: "POST", body: JSON.stringify(body) });
    const sent = JSON.parse(String(calls[0]!.init!.body));
    expect(sent.tools).toHaveLength(2);
    expect(sent.tools[1]).toEqual(WEB_SEARCH_TOOL);
    expect(sent.model).toBe("m");
  });

  it("works without other tools and never adds it twice", async () => {
    const { calls, base } = recorder();
    const f = withWebSearch(base);
    await f("u", { body: JSON.stringify({ model: "m" }) });
    expect(JSON.parse(String(calls[0]!.init!.body)).tools).toEqual([WEB_SEARCH_TOOL]);
    await f("u", { body: JSON.stringify({ tools: [WEB_SEARCH_TOOL] }) });
    expect(JSON.parse(String(calls[1]!.init!.body)).tools).toHaveLength(1);
  });

  it("bounds the searches", () => {
    expect(WEB_SEARCH_TOOL.parameters.max_uses).toBeLessThanOrEqual(3);
    expect(WEB_SEARCH_TOOL.parameters.max_total_results).toBeLessThanOrEqual(15);
  });

  it("passes other bodies through untouched", async () => {
    const { calls, base } = recorder();
    const f = withWebSearch(base);
    await f("u", { body: "not json" });
    await f("u", { body: "[1,2]" });
    await f("u");
    expect(calls[0]!.init!.body).toBe("not json");
    expect(calls[1]!.init!.body).toBe("[1,2]");
    expect(calls[2]!.init).toBeUndefined();
  });
});

describe("prompt", () => {
  it("only mentions web search when it is on, and treats results as data", () => {
    expect(buildSystemPrompt()).toBe(SYSTEM_PROMPT);
    expect(SYSTEM_PROMPT).not.toContain("# Web search");
    const on = buildSystemPrompt({ webSearch: true });
    expect(on).toContain("# Web search");
    expect(on).toContain("DATA");
    expect(on).toContain("link");
  });

  it("invites the model to use frontmatter and mdoc", () => {
    expect(SYSTEM_PROMPT).toContain("# Frontmatter and layout");
    expect(SYSTEM_PROMPT).not.toContain("Do not change either unless asked");
    for (const word of ["page.orientation", "margins", "header", "toc", "language", "tags", "unit"]) {
      expect(SYSTEM_PROMPT).toContain(word);
    }
  });

  it("shows the frontmatter of the open file in the context", () => {
    const withHead = buildContext({ openFile: "a.md", frontmatter: "---\ntitle: A\n---" });
    expect(withHead).toContain("Frontmatter of the open file:");
    expect(withHead).toContain("title: A");
    expect(buildContext({ openFile: "a.md", frontmatter: null })).toContain("no frontmatter");
    expect(buildContext({ openFile: null })).not.toContain("frontmatter");
  });
});

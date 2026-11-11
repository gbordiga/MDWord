import { describe, expect, it } from "vitest";
import {
  activeRules,
  activeSlash,
  agentFileIssues,
  agentFileKind,
  buildCapabilities,
  EMPTY_CAPABILITIES,
  globIssue,
  globMatches,
  invokedContext,
  isAgentConfigPath,
  parseFrontmatter,
  renderCapabilities,
  resolveSlash,
  slashBadgeLength,
  slashChoices
} from "./skills";

const skill = (name: string, description = "Do the thing. Use when asked.", extra = "") =>
  `---\nname: ${name}\ndescription: ${description}\n${extra}---\n\n# ${name}\n\nSteps.\n`;

describe("parseFrontmatter", () => {
  it("reads strings, booleans, lists, and block text", () => {
    const parsed = parseFrontmatter(
      [
        "---",
        "name: pdf-tools",
        'description: "Extract text: PDFs"',
        "disable-model-invocation: true",
        "globs: [a.md, 'b.md']",
        "paths:",
        "  - one.md",
        "  - two.md",
        "folded: >",
        "  first",
        "  second",
        "metadata:",
        "  author: me",
        "---",
        "Body"
      ].join("\n")
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data).toMatchObject({
      name: "pdf-tools",
      description: "Extract text: PDFs",
      "disable-model-invocation": true,
      globs: ["a.md", "b.md"],
      paths: ["one.md", "two.md"],
      folded: "first second"
    });
    expect(parsed.body.trim()).toBe("Body");
  });

  it("explains a missing or open frontmatter block", () => {
    expect(parseFrontmatter("# Title").ok).toBe(false);
    expect(parseFrontmatter("---\nname: x\n")).toMatchObject({ ok: false });
  });
});

describe("paths", () => {
  it("finds skills and rules only where they belong", () => {
    expect(agentFileKind(".agents/skills/a/SKILL.md")).toBe("skill");
    expect(agentFileKind(".agents/skills/team/a/SKILL.md")).toBe("skill");
    expect(agentFileKind(".claude/skills/a/SKILL.md")).toBe("skill");
    expect(agentFileKind(".agents/skills/a/notes.md")).toBeNull();
    expect(agentFileKind("docs/.agents/skills/a/SKILL.md")).toBeNull();
    expect(agentFileKind(".agents/rules/ui.md")).toBe("rule");
    expect(agentFileKind(".agents/rules/sub/ui.md")).toBeNull();
  });

  it("marks files that steer later turns", () => {
    expect(isAgentConfigPath(".agents/rules/x.md")).toBe(true);
    expect(isAgentConfigPath("notes/AGENTS.md")).toBe(true);
    expect(isAgentConfigPath("notes/a.md")).toBe(false);
  });
});

describe("globs", () => {
  it("matches names at any depth and paths with **/", () => {
    expect(globMatches("*.sql", "db/migrations/001.sql")).toBe(true);
    expect(globMatches("*.sql", "db/a.md")).toBe(false);
    expect(globMatches("**/src/ui/**", "app/src/ui/button.tsx")).toBe(true);
    expect(globMatches("**/src/ui/**", "src/ui/a/b.tsx")).toBe(true);
    expect(globMatches("**/src/ui/**", "src/api/a.ts")).toBe(false);
    expect(globMatches("**/docs/*.md", "docs/a.md")).toBe(true);
    expect(globMatches("**/docs/*.md", "docs/x/a.md")).toBe(false);
    expect(globMatches("note-?.md", "n/note-1.md")).toBe(true);
    expect(globMatches("[ab]*.md", "b-1.md")).toBe(true);
  });

  it("rejects patterns that agents read differently", () => {
    for (const bad of ["src/ui/**", "*.{ts,tsx}", "!a.md", "/abs/*.md", "src/**.ts", "[^a].md", "a/"]) {
      expect(globIssue(bad), bad).not.toBeNull();
    }
    for (const ok of ["*.sql", "Makefile", "**/src/ui/**", "**/migrations/*.sql"]) {
      expect(globIssue(ok), ok).toBeNull();
    }
  });
});

describe("buildCapabilities", () => {
  it("lets .agents win over .claude and keeps hidden skills out of the model list", () => {
    const caps = buildCapabilities([
      { path: ".claude/skills/a/SKILL.md", content: skill("a", "Old one") },
      { path: ".agents/skills/a/SKILL.md", content: skill("a", "New one") },
      { path: ".agents/skills/b/SKILL.md", content: skill("b", "Only by command", "disable-model-invocation: true\n") }
    ]);
    expect(caps.skills.map((s) => [s.name, s.description, s.autoInvoke])).toEqual([
      ["a", "New one", true],
      ["b", "Only by command", false]
    ]);
    const prompt = renderCapabilities(caps, []);
    expect(prompt).toContain("<name>a</name>");
    expect(prompt).toContain("<location>.agents/skills/a/SKILL.md</location>");
    expect(prompt).not.toContain("<name>b</name>");
  });

  it("reports skills and rules it cannot use", () => {
    const caps = buildCapabilities([
      { path: ".agents/skills/x/SKILL.md", content: "# no frontmatter" },
      { path: ".agents/skills/y/SKILL.md", content: "---\nname: y\n---\nBody" },
      { path: ".agents/rules/z.md", content: "---\ntrigger: alwaysOn\n---\nText" }
    ]);
    expect(caps.skills).toEqual([]);
    expect(caps.rules).toEqual([]);
    expect(renderCapabilities(caps, [])).toContain(".agents/skills/y/SKILL.md");
    expect(caps.issues.map((i) => i.path).sort()).toEqual([
      ".agents/rules/z.md",
      ".agents/skills/x/SKILL.md",
      ".agents/skills/y/SKILL.md"
    ]);
  });

  it("applies always-on and matching glob rules, and indexes model-decision rules", () => {
    const caps = buildCapabilities([
      { path: ".agents/rules/tone.md", content: "---\ntrigger: always_on\n---\nWrite plainly." },
      { path: ".agents/rules/sql.md", content: '---\ntrigger: glob\nglobs: "*.sql"\n---\nUpper-case keywords.' },
      { path: ".agents/rules/legal.md", content: "---\ntrigger: model_decision\ndescription: Contract wording\n---\nCite clauses." },
      { path: ".agents/rules/later.md", content: "---\ntrigger: manual\n---\nOnly when called." },
      { path: ".agents/rules/cursor.md", content: "---\nalwaysApply: true\n---\nCursor style." }
    ]);
    expect(activeRules(caps.rules, ["db/a.sql"]).map((r) => r.name)).toEqual(["cursor", "sql", "tone"]);
    expect(activeRules(caps.rules, ["notes/a.md"]).map((r) => r.name)).toEqual(["cursor", "tone"]);
    const prompt = renderCapabilities(caps, ["notes/a.md"]);
    expect(prompt).toContain("Write plainly.");
    expect(prompt).not.toContain("Upper-case keywords.");
    expect(prompt).toContain("- .agents/rules/legal.md: Contract wording");
    expect(prompt).not.toContain("Only when called.");
  });

  it("is empty when there is nothing", () => {
    expect(renderCapabilities(buildCapabilities([]), [])).toBe("");
  });
});

describe("agentFileIssues", () => {
  it("is null for other files", () => {
    expect(agentFileIssues("notes/a.md", "# a")).toBeNull();
  });

  it("checks a skill", () => {
    expect(agentFileIssues(".agents/skills/a/SKILL.md", skill("a"))).toEqual([]);
    expect(agentFileIssues(".agents/skills/a/SKILL.md", skill("b"))?.[0]).toContain("must match its folder");
    expect(agentFileIssues(".agents/skills/A/SKILL.md", skill("A"))?.[0]).toContain("lowercase");
    expect(agentFileIssues(".agents/skills/a/SKILL.md", "---\nname: a\n---\nx")?.[0]).toContain("description");
    expect(agentFileIssues(".agents/skills/a/SKILL.md", "# x")?.[0]).toContain("frontmatter");
  });

  it("checks a rule", () => {
    expect(agentFileIssues(".agents/rules/a.md", "---\ntrigger: always_on\n---\nx")).toEqual([]);
    expect(agentFileIssues(".agents/rules/a.md", "---\ntrigger: alwaysOn\n---\nx")?.[0]).toContain("snake_case");
    expect(agentFileIssues(".agents/rules/a.md", "---\ntrigger: model_decision\n---\nx")?.[0]).toContain("description");
    expect(agentFileIssues(".agents/rules/a.md", "---\ntrigger: glob\n---\nx")?.[0]).toContain("globs");
    expect(agentFileIssues(".agents/rules/a.md", '---\ntrigger: glob\nglobs: "src/**"\n---\nx')?.[0]).toContain("**/");
  });
});

describe("slash command", () => {
  const caps = buildCapabilities([
    { path: ".agents/skills/pdf-tools/SKILL.md", content: skill("pdf-tools", "Read PDFs") },
    { path: ".agents/rules/tone.md", content: "---\ntrigger: manual\n---\nPlain." }
  ]);

  it("opens only for the first word", () => {
    expect(activeSlash("/pd", 3)).toEqual({ end: 3, query: "pd" });
    expect(activeSlash("/pd rest", 8)).toBeNull();
    expect(activeSlash("hello /pd", 9)).toBeNull();
    expect(activeSlash("/", 1)).toEqual({ end: 1, query: "" });
  });

  it("lists skills and rules that match", () => {
    expect(slashChoices(caps, "").map((c) => c.id)).toEqual(["skill:pdf-tools", "rule:tone", "new:skill", "new:rule"]);
    expect(slashChoices(caps, "pdf").map((c) => c.id)).toEqual(["skill:pdf-tools"]);
    expect(slashChoices(caps, "zzz")).toEqual([]);
  });

  it("always offers to create a skill or a rule, even in a project that has none", () => {
    expect(slashChoices(EMPTY_CAPABILITIES, "").map((c) => c.id)).toEqual(["new:skill", "new:rule"]);
    expect(slashChoices(EMPTY_CAPABILITIES, "new").map((c) => c.kind)).toEqual(["new-skill", "new-rule"]);
    expect(slashChoices(EMPTY_CAPABILITIES, "ski").map((c) => c.kind)).toEqual(["new-skill"]);
  });

  it("resolves the command and keeps the request", () => {
    expect(resolveSlash("/skill:pdf-tools extract report.pdf", caps)).toMatchObject({
      kind: "skill",
      name: "pdf-tools",
      request: "extract report.pdf"
    });
    expect(resolveSlash("/pdf-tools", caps)).toMatchObject({ kind: "skill", request: "" });
    expect(resolveSlash("/rule:tone shorten", caps)).toMatchObject({ kind: "rule", request: "shorten" });
    expect(resolveSlash("/skill:tone", caps)).toBeNull();
    expect(resolveSlash("/etc/hosts", caps)).toBeNull();
    expect(resolveSlash("plain text", caps)).toBeNull();
  });

  it("measures the badge for a real name only", () => {
    expect(slashBadgeLength("/pdf-tools extract it", caps)).toBe("/pdf-tools".length);
    expect(slashBadgeLength("/tone", caps)).toBe("/tone".length);
    expect(slashBadgeLength("/unknown rest", caps)).toBe(0);
    expect(slashBadgeLength("text /pdf-tools", caps)).toBe(0);
  });

  it("wraps the file text for the turn", () => {
    const text = invokedContext({ kind: "skill", name: "pdf-tools", path: "p", request: "" }, "  Steps.  ");
    expect(text).toContain('"pdf-tools"');
    expect(text).toContain("<<<\nSteps.\n>>>");
  });
});

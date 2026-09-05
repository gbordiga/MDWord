import { parseDocument, Document as YamlDocument } from "yaml";
import type { Diagnostic } from "@mdword/shared";

export interface FrontmatterExtraction {
  yaml: YamlDocument | null;
  rawYaml: string | null;
  body: string;
  hasFrontmatter: boolean;
  diagnostics: Diagnostic[];
}

const OPEN = /^---[ \t]*\r?\n/;

export function extractFrontmatter(source: string): FrontmatterExtraction {
  const diagnostics: Diagnostic[] = [];
  if (!OPEN.test(source)) {
    return {
      yaml: null,
      rawYaml: null,
      body: source,
      hasFrontmatter: false,
      diagnostics
    };
  }
  const afterOpen = source.replace(OPEN, "");
  const close = afterOpen.search(/\r?\n---[ \t]*(?:\r?\n|$)/);
  if (close === -1) {
    diagnostics.push({
      severity: "warning",
      message: "Unclosed YAML frontmatter",
      code: "yaml-unclosed",
      line: 1
    });
    return {
      yaml: null,
      rawYaml: null,
      body: source,
      hasFrontmatter: false,
      diagnostics
    };
  }
  const rawYaml = afterOpen.slice(0, close);
  const rest = afterOpen.slice(close).replace(/^\r?\n---[ \t]*/, "");
  const body = rest.replace(/^\r?\n/, "");
  try {
    const yaml = parseDocument(rawYaml, { keepSourceTokens: true });
    if (yaml.errors.length) {
      for (const err of yaml.errors) {
        diagnostics.push({
          severity: "error",
          message: err.message,
          code: "yaml-parse",
          line: err.linePos?.[0]?.line
        });
      }
    }
    return { yaml, rawYaml, body, hasFrontmatter: true, diagnostics };
  } catch (error) {
    diagnostics.push({
      severity: "error",
      message: error instanceof Error ? error.message : "YAML parse failed",
      code: "yaml-parse",
      line: 1
    });
    return { yaml: null, rawYaml, body, hasFrontmatter: true, diagnostics };
  }
}

export function yamlToPlain(doc: YamlDocument | null): Record<string, unknown> {
  if (!doc || doc.errors.length) return {};
  const js = doc.toJS({ maxAliasCount: 100 });
  if (js && typeof js === "object" && !Array.isArray(js)) {
    return js as Record<string, unknown>;
  }
  return {};
}

export function dumpYaml(doc: YamlDocument): string {
  return doc.toString({ lineWidth: 0 }).replace(/\s+$/, "");
}

export function setYamlMapValue(
  doc: YamlDocument,
  path: string[],
  value: unknown
): void {
  doc.setIn(path, value);
}

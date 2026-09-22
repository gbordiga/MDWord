import { parseDocument, Document as YamlDocument } from "yaml";
import { stripTrailingWhitespace, type Diagnostic } from "@mdword/shared";

export interface FrontmatterExtraction {
  yaml: YamlDocument | null;
  rawYaml: string | null;
  body: string;
  hasFrontmatter: boolean;
  diagnostics: Diagnostic[];
}

const OPEN = /^---[ \t]*\r?\n/;

const CLOSE = /\r?\n---[ \t]*(?:\r?\n|$)/;

/** Exact `head + rest === source`. `rest` is the markdown body, including any blank line after `---`. */
export function splitMarkdownSource(source: string): { head: string; rest: string } {
  if (!OPEN.test(source)) return { head: "", rest: source };
  const open = source.match(OPEN);
  if (!open) return { head: "", rest: source };
  const afterOpen = source.slice(open[0].length);
  const close = CLOSE.exec(afterOpen);
  if (!close) return { head: "", rest: source };
  const headEnd = open[0].length + close.index + close[0].length;
  return { head: source.slice(0, headEnd), rest: source.slice(headEnd) };
}

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
  if (!doc) return {};
  try {
    const js = doc.toJS({ maxAliasCount: 100 });
    if (js && typeof js === "object" && !Array.isArray(js)) {
      return js as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  return {};
}

export function dumpYaml(doc: YamlDocument): string {
  return stripTrailingWhitespace(doc.toString({ lineWidth: 0 }));
}

export function setYamlMapValue(
  doc: YamlDocument,
  path: string[],
  value: unknown
): void {
  doc.setIn(path, value);
}

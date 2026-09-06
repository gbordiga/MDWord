import { mystParse } from "myst-parser";
import { VFile } from "vfile";
import {
  type Diagnostic,
  type GenericNode,
  rewriteWikiLinksToMarkdown
} from "@mdword/shared";
import { parseMdoc, type Mdoc } from "@mdword/layout-engine";
import { extractFrontmatter, yamlToPlain } from "./frontmatter";
import type { Document as YamlDocument } from "yaml";

export interface ParseResult {
  source: string;
  body: string;
  ast: GenericNode;
  frontmatter: Record<string, unknown>;
  yaml: YamlDocument | null;
  mdoc: Mdoc;
  diagnostics: Diagnostic[];
}

function isKnownPageBreakMessage(message: string): boolean {
  return /unknown directive:\s*page-break/i.test(message);
}

function collectUnknown(ast: GenericNode, diagnostics: Diagnostic[]): void {
  const walk = (node: GenericNode) => {
    if (node.type === "mystDirective" && typeof node.name === "string") {
      const known = new Set([
        "note",
        "tip",
        "warning",
        "important",
        "attention",
        "caution",
        "danger",
        "error",
        "hint",
        "seealso",
        "admonition",
        "figure",
        "image",
        "code",
        "code-block",
        "math",
        "equation",
        "table",
        "list-table",
        "include",
        "toc",
        "contents",
        "page-break",
        "mermaid",
        "iframe"
      ]);
      if (!known.has(node.name) && !node.children?.length && node.value) {
        diagnostics.push({
          severity: "info",
          message: `Unsupported directive "${node.name}" preserved as raw block`,
          code: "unknown-directive"
        });
      }
    }
    node.children?.forEach(walk);
  };
  walk(ast);
}

export function parseMarkdown(source: string): ParseResult {
  const fm = extractFrontmatter(source);
  const diagnostics = [...fm.diagnostics];
  const plain = yamlToPlain(fm.yaml);
  const { value: mdoc, issues } = parseMdoc(plain.mdoc ?? {});
  for (const issue of issues) {
    diagnostics.push({
      severity: "warning",
      message: `mdoc: ${issue}`,
      code: "mdoc-schema"
    });
  }

  const rewritten = rewriteWikiLinksToMarkdown(fm.body);
  const vfile = new VFile();
  let ast: GenericNode = { type: "root", children: [] };
  try {
    ast = mystParse(rewritten, {
      vfile,
      extensions: {
        strikethrough: true,
        frontmatter: false,
        colonFences: true,
        math: true,
        footnotes: true,
        tables: true,
        tasklist: true,
        citations: true
      }
    }) as GenericNode;
  } catch (error) {
    diagnostics.push({
      severity: "error",
      message: error instanceof Error ? error.message : "Markdown parse failed",
      code: "md-parse"
    });
    ast = {
      type: "root",
      children: [
        {
          type: "code",
          lang: "markdown",
          value: fm.body
        }
      ]
    };
  }

  for (const msg of vfile.messages) {
    if (isKnownPageBreakMessage(msg.message)) continue;
    diagnostics.push({
      severity: msg.fatal ? "error" : "warning",
      message: msg.message,
      line: msg.line ?? undefined,
      column: msg.column ?? undefined,
      code: "myst"
    });
  }

  collectUnknown(ast, diagnostics);

  return {
    source,
    body: fm.body,
    ast,
    frontmatter: plain,
    yaml: fm.yaml,
    mdoc,
    diagnostics
  };
}

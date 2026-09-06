import { parseMarkdown, type ParseResult } from "@mdword/myst-parser";
import { serializeMarkdown } from "@mdword/markdown-serializer";
import {
  APPLICATION_DEFAULTS,
  getTemplate,
  resolveMdoc,
  type Mdoc
} from "@mdword/layout-engine";
import type { Diagnostic, GenericNode } from "@mdword/shared";
import { parseDocument, stringify as stringifyYaml } from "yaml";

export interface DocumentModel {
  source: string;
  ast: GenericNode;
  frontmatter: Record<string, unknown>;
  mdoc: Mdoc;
  resolvedMdoc: Mdoc;
  diagnostics: Diagnostic[];
  yamlCst: ParseResult["yaml"];
}

export interface OpenDocumentOptions {
  workspaceMdoc?: Mdoc;
}

function fallbackDocument(
  source: string,
  options: OpenDocumentOptions,
  error: unknown
): DocumentModel {
  const resolvedMdoc = resolveMdoc({
    application: APPLICATION_DEFAULTS,
    workspace: options.workspaceMdoc,
    document: { version: 1 }
  });
  return {
    source,
    ast: {
      type: "root",
      children: [{ type: "code", lang: "markdown", value: source }]
    },
    frontmatter: {},
    mdoc: { version: 1 },
    resolvedMdoc,
    diagnostics: [
      {
        severity: "error",
        message: error instanceof Error ? error.message : "Failed to open document",
        code: "open-failed"
      }
    ],
    yamlCst: null
  };
}

export function openDocument(
  source: string,
  options: OpenDocumentOptions = {}
): DocumentModel {
  try {
    const parsed = parseMarkdown(source);
    const template = getTemplate(
      typeof parsed.mdoc.template === "string" ? parsed.mdoc.template : undefined
    );
    const resolvedMdoc = resolveMdoc({
      application: APPLICATION_DEFAULTS,
      workspace: options.workspaceMdoc,
      template: template?.mdoc,
      document: parsed.mdoc
    });
    return {
      source,
      ast: parsed.ast,
      frontmatter: parsed.frontmatter,
      mdoc: parsed.mdoc,
      resolvedMdoc,
      diagnostics: parsed.diagnostics,
      yamlCst: parsed.yaml
    };
  } catch (error) {
    return fallbackDocument(source, options, error);
  }
}

export function saveDocument(model: DocumentModel): string {
  return serializeMarkdown({ ast: model.ast, yaml: model.yamlCst });
}

export function updateFrontmatter(
  model: DocumentModel,
  patch: Record<string, unknown>
): DocumentModel {
  const next = { ...model.frontmatter, ...patch };
  if (model.yamlCst) {
    for (const [key, value] of Object.entries(patch)) {
      model.yamlCst.set(key, value);
    }
  } else {
    const yaml = parseDocument(stringifyYaml(next), { keepSourceTokens: true });
    model.yamlCst = yaml;
  }
  const reopened = openDocument(saveDocument({ ...model, frontmatter: next }), {
    workspaceMdoc: undefined
  });
  return { ...reopened };
}

export function semanticAstEqual(a: GenericNode, b: GenericNode): boolean {
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}

function strip(node: GenericNode): unknown {
  const { position, data, ...rest } = node;
  void position;
  void data;
  const children = node.children?.map(strip);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v === undefined || k === "children") continue;
    out[k] = v;
  }
  if (children) out.children = children;
  return out;
}

export function roundTrip(source: string): {
  first: DocumentModel;
  serialized: string;
  second: DocumentModel;
  equal: boolean;
} {
  const first = openDocument(source);
  const serialized = saveDocument(first);
  const second = openDocument(serialized);
  return {
    first,
    serialized,
    second,
    equal: semanticAstEqual(first.ast, second.ast)
  };
}

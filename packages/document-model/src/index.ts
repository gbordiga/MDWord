import { parseMarkdown, type ParseResult } from "@mdword/myst-parser";
import { serializeMarkdown } from "@mdword/markdown-serializer";
import {
  APPLICATION_DEFAULTS,
  getTemplate,
  resolveMdoc,
  type Mdoc
} from "@mdword/layout-engine";
import type { Diagnostic, GenericNode } from "@mdword/shared";
import { parseDocument, stringify as stringifyYaml, type Document as YamlDocument } from "yaml";
import {
  initialFrontmatterValue,
  isFrontmatterKey,
  LAYOUT_FRONTMATTER_KEY,
  type FrontmatterValueKind
} from "./frontmatterEdit";

export {
  DOCUMENT_PROPERTY_KEYS,
  FRONTMATTER_LABELS,
  LAYOUT_FRONTMATTER_KEY,
  SUGGESTED_FRONTMATTER_KEYS,
  formatFrontmatterList,
  formatFrontmatterScalar,
  frontmatterLabel,
  frontmatterValueKind,
  initialFrontmatterValue,
  isDocumentPropertyKey,
  isFrontmatterKey,
  listCustomFrontmatterKeys,
  listFrontmatterKeys,
  parseFrontmatterList,
  parseFrontmatterObject
} from "./frontmatterEdit";
export type { FrontmatterValueKind } from "./frontmatterEdit";

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

function ensureYaml(model: DocumentModel, plain: Record<string, unknown>) {
  if (model.yamlCst) return model.yamlCst;
  return parseDocument(stringifyYaml(plain), { keepSourceTokens: true });
}

function commitFrontmatter(
  model: DocumentModel,
  yaml: YamlDocument,
  frontmatter: Record<string, unknown>,
  workspaceMdoc?: Mdoc
): DocumentModel {
  return openDocument(saveDocument({ ...model, yamlCst: yaml, frontmatter }), { workspaceMdoc });
}

export function setFrontmatterValues(
  model: DocumentModel,
  patch: Record<string, unknown>,
  workspaceMdoc?: Mdoc
): DocumentModel {
  const frontmatter = { ...model.frontmatter, ...patch };
  const yaml = ensureYaml(model, frontmatter);
  for (const [key, value] of Object.entries(patch)) {
    if (!isFrontmatterKey(key) || key === LAYOUT_FRONTMATTER_KEY) continue;
    yaml.set(key, value);
  }
  return commitFrontmatter(model, yaml, frontmatter, workspaceMdoc);
}

export function removeFrontmatterKey(
  model: DocumentModel,
  key: string,
  workspaceMdoc?: Mdoc
): DocumentModel {
  if (key === LAYOUT_FRONTMATTER_KEY || !isFrontmatterKey(key)) return model;
  const frontmatter = { ...model.frontmatter };
  delete frontmatter[key];
  const yaml = ensureYaml(model, frontmatter);
  yaml.delete(key);
  return commitFrontmatter(model, yaml, frontmatter, workspaceMdoc);
}

export function renameFrontmatterKey(
  model: DocumentModel,
  from: string,
  to: string,
  workspaceMdoc?: Mdoc
): DocumentModel {
  const next = to.trim();
  if (from === next) return model;
  if (from === LAYOUT_FRONTMATTER_KEY || next === LAYOUT_FRONTMATTER_KEY) return model;
  if (!isFrontmatterKey(from) || !isFrontmatterKey(next)) return model;
  if (Object.prototype.hasOwnProperty.call(model.frontmatter, next)) return model;
  const value = model.frontmatter[from];
  const frontmatter = { ...model.frontmatter };
  delete frontmatter[from];
  frontmatter[next] = value;
  const yaml = ensureYaml(model, frontmatter);
  yaml.delete(from);
  yaml.set(next, value);
  return commitFrontmatter(model, yaml, frontmatter, workspaceMdoc);
}

export function addFrontmatterKey(
  model: DocumentModel,
  key: string,
  kind: FrontmatterValueKind = "string",
  workspaceMdoc?: Mdoc
): DocumentModel {
  const next = key.trim();
  if (!isFrontmatterKey(next) || next === LAYOUT_FRONTMATTER_KEY) return model;
  if (Object.prototype.hasOwnProperty.call(model.frontmatter, next)) return model;
  return setFrontmatterValues(model, { [next]: initialFrontmatterValue(kind) }, workspaceMdoc);
}

export function updateFrontmatter(
  model: DocumentModel,
  patch: Record<string, unknown>
): DocumentModel {
  return setFrontmatterValues(model, patch);
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

import { parseMarkdown, splitMarkdownSource, type ParseResult, type SourceSpan } from "@mdword/myst-parser";
import { serializeMarkdown } from "@mdword/markdown-serializer";
import {
  APPLICATION_DEFAULTS,
  getTemplate,
  resolveMdoc,
  type Mdoc
} from "@mdword/layout-engine";
import {
  canonicalizeEmbeddedImages,
  shouldRepairEmbeddedImages,
  type Diagnostic,
  type GenericNode
} from "@mdword/shared";
import { parseDocument, stringify as stringifyYaml, type Document as YamlDocument } from "yaml";
import {
  initialFrontmatterValue,
  isFrontmatterKey,
  LAYOUT_FRONTMATTER_KEY,
  type FrontmatterValueKind
} from "./frontmatterEdit";
import { composeMarkdown, composeWithYaml } from "./sourceCompose";
import { semanticAstEqual } from "./semantic";
import { applyVisualAst, type ApplyVisualOptions } from "./applyVisual";

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
export { semanticAstEqual } from "./semantic";
export { applyVisualAst } from "./applyVisual";
export type { ApplyVisualOptions, VisualOrigin } from "./applyVisual";
export { composeMarkdown, composeWithYaml } from "./sourceCompose";

export interface DocumentModel {
  source: string;
  head: string;
  body: string;
  ast: GenericNode;
  frontmatter: Record<string, unknown>;
  mdoc: Mdoc;
  resolvedMdoc: Mdoc;
  diagnostics: Diagnostic[];
  yamlCst: ParseResult["yaml"];
  blockSpans: SourceSpan[];
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
    head: "",
    body: source,
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
    yamlCst: null,
    blockSpans: []
  };
}

export function openDocument(
  source: string,
  options: OpenDocumentOptions = {}
): DocumentModel {
  try {
    const { head, rest } = splitMarkdownSource(source);
    const opened = shouldRepairEmbeddedImages(rest)
      ? composeMarkdown(head, canonicalizeEmbeddedImages(rest))
      : source;
    const parsed = parseMarkdown(opened);
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
      source: opened,
      head: parsed.head,
      body: parsed.body,
      ast: parsed.ast,
      frontmatter: parsed.frontmatter,
      mdoc: parsed.mdoc,
      resolvedMdoc,
      diagnostics: parsed.diagnostics,
      yamlCst: parsed.yaml,
      blockSpans: parsed.blockSpans
    };
  } catch (error) {
    return fallbackDocument(source, options, error);
  }
}

export function saveDocument(model: DocumentModel): string {
  return model.source ?? "";
}

/** Canonical MyST serialization — used for new regions, fallback, and serializer tests. */
export function serializeDocument(model: DocumentModel): string {
  try {
    return serializeMarkdown({ ast: model.ast, yaml: model.yamlCst });
  } catch (error) {
    console.error("Could not serialize document", error);
    return model.source ?? "";
  }
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
  const source = composeWithYaml(yaml, model.body, Boolean(model.head));
  return openDocument(source, { workspaceMdoc });
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

export function roundTrip(source: string): {
  first: DocumentModel;
  serialized: string;
  second: DocumentModel;
  equal: boolean;
} {
  const first = openDocument(source);
  const serialized = serializeDocument(first);
  const second = openDocument(serialized);
  return {
    first,
    serialized,
    second,
    equal: semanticAstEqual(first.ast, second.ast)
  };
}

export function applyVisualDocument(
  model: DocumentModel,
  nextAst: GenericNode,
  options: ApplyVisualOptions
): DocumentModel {
  return applyVisualAst(model, nextAst, options, (source, workspaceMdoc) =>
    openDocument(source, { workspaceMdoc })
  );
}

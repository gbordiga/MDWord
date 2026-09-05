import { writeMd } from "myst-to-md";
import { VFile } from "vfile";
import { dumpYaml } from "@mdword/myst-parser";
import { rewriteMarkdownToWikiLinks, type GenericNode } from "@mdword/shared";
import type { Document as YamlDocument } from "yaml";

function serializeBody(ast: GenericNode): string {
  const file = new VFile();
  writeMd(file, ast as never);
  const result = (file as { result?: string }).result;
  const raw = (typeof result === "string" ? result : String(file.value ?? "")).trim();
  return rewriteMarkdownToWikiLinks(raw);
}

export function serializeMarkdown(options: {
  ast: GenericNode;
  yaml?: YamlDocument | null;
}): string {
  const body = serializeBody(options.ast);
  if (options.yaml && !options.yaml.errors.length) {
    const yamlText = dumpYaml(options.yaml).trim();
    if (!yamlText || yamlText === "undefined" || yamlText === "") {
      return body ? `${body}\n` : "";
    }
    return `---\n${yamlText}\n---\n${body ? `\n${body}\n` : "\n"}`;
  }
  return body ? `${body}\n` : "";
}

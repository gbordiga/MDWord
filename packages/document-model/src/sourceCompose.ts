import { dumpYaml } from "@mdword/myst-parser";
import type { Document as YamlDocument } from "yaml";

export function composeYamlHead(yaml: YamlDocument | null): string | null {
  if (!yaml || yaml.errors.length) return null;
  const yamlText = dumpYaml(yaml).trim();
  if (!yamlText || yamlText === "undefined") return null;
  return `---\n${yamlText}\n---\n`;
}

export function composeMarkdown(head: string, body: string): string {
  return `${head}${body}`;
}

/** Replace YAML, keep the exact body bytes. */
export function composeWithYaml(yaml: YamlDocument | null, body: string, hadHead: boolean): string {
  const nextHead = composeYamlHead(yaml);
  if (!nextHead) return body;
  if (!hadHead && body && !body.startsWith("\n")) return `${nextHead}\n${body}`;
  return `${nextHead}${body}`;
}

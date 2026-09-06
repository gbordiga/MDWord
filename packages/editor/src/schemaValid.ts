import { getSchema } from "@tiptap/core";
import { Node } from "@tiptap/pm/model";
import { editorExtensions } from "./schema";
import type { TiptapNode } from "./astToTiptap";

export function collectEmptyTextPaths(node: TiptapNode, path = "doc"): string[] {
  const found: string[] = [];
  if (node.type === "text" && !node.text) found.push(path);
  (node.content ?? []).forEach((child, i) => {
    found.push(...collectEmptyTextPaths(child, `${path}/${node.type}[${i}]`));
  });
  return found;
}

export function tiptapDocFromJson(json: TiptapNode): Node {
  return Node.fromJSON(getSchema(editorExtensions()), json);
}

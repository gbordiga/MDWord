import type { GenericNode } from "@mdword/shared";

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

/** Plain text of a figure caption stored as inline nodes. */
export function mermaidCaptionText(caption: unknown): string {
  const walk = (nodes: unknown): string =>
    Array.isArray(nodes)
      ? nodes.map((n: { text?: string; content?: unknown }) => n.text ?? walk(n.content)).join("")
      : "";
  return walk(caption).trim();
}

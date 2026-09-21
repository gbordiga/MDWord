export const LEFT_PANELS = ["files", "outline", "search", "history"] as const;
export type LeftPanel = (typeof LEFT_PANELS)[number];

/** Drop removed panels such as the old backlinks tab. */
export function resolveLeftPanel(panel: string): LeftPanel {
  return (LEFT_PANELS as readonly string[]).includes(panel) ? (panel as LeftPanel) : "files";
}

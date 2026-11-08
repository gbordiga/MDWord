export const LEFT_PANELS = ["properties", "outline", "files", "search"] as const;
export type LeftPanel = (typeof LEFT_PANELS)[number];

/** Drop removed panels such as the old backlinks and history tabs. */
export function resolveLeftPanel(panel: string): LeftPanel {
  return (LEFT_PANELS as readonly string[]).includes(panel) ? (panel as LeftPanel) : "files";
}

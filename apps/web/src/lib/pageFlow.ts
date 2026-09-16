/** Sum block heights; skip page-gap spacers and wrappers that stretch with the sheet stack. */
export function measureEditorFlowHeight(root: HTMLElement): number {
  let total = 0;
  const visit = (parent: Element) => {
    for (const child of Array.from(parent.children)) {
      if (!("offsetHeight" in child) || !("classList" in child)) continue;
      const el = child as HTMLElement;
      if (el.classList.contains("md-page-gap")) continue;
      if (el.classList.contains("md-editor-fill") || el.classList.contains("ProseMirror")) {
        visit(el);
        continue;
      }
      total += el.offsetHeight;
    }
  };
  visit(root);
  return total;
}

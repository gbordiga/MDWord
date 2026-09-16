type FlowEl = {
  classList: { contains(name: string): boolean };
  offsetHeight: number;
  children: ArrayLike<FlowEl>;
};

/** Sum block heights; skip page-gap spacers and wrappers that stretch with the sheet stack. */
export function measureEditorFlowHeight(root: FlowEl): number {
  let total = 0;
  const visit = (parent: FlowEl) => {
    for (let i = 0; i < parent.children.length; i += 1) {
      const child = parent.children[i];
      if (!child) continue;
      if (child.classList.contains("md-page-gap")) continue;
      if (child.classList.contains("md-editor-fill") || child.classList.contains("ProseMirror")) {
        visit(child);
        continue;
      }
      total += child.offsetHeight;
    }
  };
  visit(root);
  return total;
}

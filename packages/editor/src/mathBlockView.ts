import type { Editor } from "@tiptap/core";
import type { Node as ProseNode } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";
import { renderKatex } from "@mdword/renderer";

function selectNodeAt(editor: Editor, getPos: (() => number | undefined) | boolean): void {
  if (typeof getPos !== "function") return;
  const pos = getPos();
  if (typeof pos !== "number") return;
  const { state, view } = editor;
  view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, pos)));
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

export function createMathBlockView({
  node,
  editor,
  getPos
}: {
  node: ProseNode;
  editor: Editor;
  getPos: (() => number | undefined) | boolean;
}): {
  dom: HTMLElement;
  update: (updated: ProseNode) => boolean;
  selectNode: () => void;
  deselectNode: () => void;
  stopEvent: (event: Event) => boolean;
  ignoreMutation: () => boolean;
  destroy: () => void;
} {
  let current = node;
  let editing = false;
  let selected = false;
  const dom = document.createElement("figure");
  const toolbar = document.createElement("div");
  const label = document.createElement("span");
  const editBtn = document.createElement("button");
  const preview = document.createElement("div");
  const editorBox = document.createElement("div");
  const textarea = document.createElement("textarea");
  const actions = document.createElement("div");
  const doneBtn = document.createElement("button");
  const cancelBtn = document.createElement("button");

  dom.className = "md-math";
  dom.dataset.testid = "doc-math-block";
  toolbar.className = "md-math-toolbar";
  label.className = "md-math-label";
  label.textContent = "Equation";
  editBtn.type = "button";
  editBtn.className = "md-math-edit";
  editBtn.textContent = "Edit source";
  preview.className = "md-math-preview";
  preview.setAttribute("role", "math");
  preview.setAttribute("aria-label", "Equation preview");
  editorBox.className = "md-math-editor";
  editorBox.hidden = true;
  textarea.className = "md-math-source";
  textarea.setAttribute("aria-label", "LaTeX source");
  textarea.spellcheck = false;
  actions.className = "md-math-actions";
  doneBtn.type = "button";
  doneBtn.textContent = "Done";
  cancelBtn.type = "button";
  cancelBtn.textContent = "Cancel";
  actions.append(doneBtn, cancelBtn);
  editorBox.append(textarea, actions);
  toolbar.append(label, editBtn);
  dom.append(toolbar, preview, editorBox);

  const setSelected = (next: boolean) => {
    selected = next;
    dom.classList.toggle("is-selected", next);
  };

  const applyLatex = (latex: string) => {
    if (typeof getPos !== "function") return;
    const pos = getPos();
    if (typeof pos !== "number") return;
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        tr.setNodeMarkup(pos, undefined, { ...current.attrs, latex });
        return true;
      })
      .run();
  };

  const showPreview = () => {
    editing = false;
    editorBox.hidden = true;
    preview.hidden = false;
    editBtn.hidden = false;
  };

  const showEditor = () => {
    editing = true;
    textarea.value = String(current.attrs.latex ?? "");
    editorBox.hidden = false;
    preview.hidden = true;
    editBtn.hidden = true;
    requestAnimationFrame(() => textarea.focus());
  };

  const render = (latex: string) => {
    const text = latex.trim();
    preview.classList.remove("is-error");
    if (!text) {
      preview.innerHTML = `<p class="md-math-empty">Empty equation — click Edit source to write LaTeX.</p>`;
      return;
    }
    const html = renderKatex(text, true);
    if (html.includes("katex-error")) {
      preview.classList.add("is-error");
      preview.innerHTML = `<p class="md-math-error">Invalid LaTeX equation.</p><pre class="md-math-fallback">${escapeHtml(
        text
      )}</pre>`;
      return;
    }
    preview.innerHTML = html;
  };

  editBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    selectNodeAt(editor, getPos);
    showEditor();
  });
  doneBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const next = textarea.value;
    applyLatex(next);
    showPreview();
    render(next);
  });
  cancelBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    showPreview();
  });
  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      showPreview();
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      const next = textarea.value;
      applyLatex(next);
      showPreview();
      render(next);
    }
  });
  dom.addEventListener("dblclick", (event) => {
    if (editing) return;
    event.preventDefault();
    selectNodeAt(editor, getPos);
    showEditor();
  });
  dom.addEventListener("mousedown", (event) => {
    if (editing) return;
    if ((event.target as HTMLElement).closest("button, textarea")) return;
    selectNodeAt(editor, getPos);
  });

  render(String(current.attrs.latex ?? ""));

  return {
    dom,
    update(updated) {
      if (updated.type.name !== "mathBlock") return false;
      const next = String(updated.attrs.latex ?? "");
      const prev = String(current.attrs.latex ?? "");
      current = updated;
      if (!editing && next !== prev) render(next);
      return true;
    },
    selectNode: () => setSelected(true),
    deselectNode: () => setSelected(false),
    stopEvent(event) {
      if (!editing) return event.type === "mousedown" || event.type === "dblclick";
      return true;
    },
    ignoreMutation: () => true,
    destroy() {
      /* no async work */
    }
  };
}

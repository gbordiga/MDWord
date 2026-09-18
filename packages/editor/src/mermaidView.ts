import type { Editor } from "@tiptap/core";
import type { Node as ProseNode } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";
import { renderMermaidSvg } from "@mdword/renderer";

function selectNodeAt(editor: Editor, getPos: (() => number | undefined) | boolean): void {
  if (typeof getPos !== "function") return;
  const pos = getPos();
  if (typeof pos !== "number") return;
  const { state, view } = editor;
  view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, pos)));
}

export function createMermaidView({
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
  let renderToken = 0;
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

  dom.className = "md-mermaid";
  dom.dataset.testid = "doc-mermaid";
  toolbar.className = "md-mermaid-toolbar";
  label.className = "md-mermaid-label";
  label.textContent = "Mermaid";
  editBtn.type = "button";
  editBtn.className = "md-mermaid-edit";
  editBtn.textContent = "Edit source";
  preview.className = "md-mermaid-preview";
  preview.setAttribute("role", "img");
  preview.setAttribute("aria-label", "Mermaid diagram");
  editorBox.className = "md-mermaid-editor";
  editorBox.hidden = true;
  textarea.className = "md-mermaid-source";
  textarea.setAttribute("aria-label", "Mermaid source");
  textarea.spellcheck = false;
  actions.className = "md-mermaid-actions";
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

  const applySource = (source: string) => {
    if (typeof getPos !== "function") return;
    const pos = getPos();
    if (typeof pos !== "number") return;
    editor.chain().focus().command(({ tr }) => {
      tr.setNodeMarkup(pos, undefined, { source });
      return true;
    }).run();
  };

  const showPreview = () => {
    editing = false;
    editorBox.hidden = true;
    preview.hidden = false;
    editBtn.hidden = false;
  };

  const showEditor = () => {
    editing = true;
    textarea.value = String(current.attrs.source ?? "");
    editorBox.hidden = false;
    preview.hidden = true;
    editBtn.hidden = true;
    requestAnimationFrame(() => textarea.focus());
  };

  const render = async (source: string) => {
    const token = ++renderToken;
    const text = source.trim();
    preview.classList.remove("is-error");
    if (!text) {
      preview.innerHTML = `<p class="md-mermaid-empty">Empty diagram — click Edit source to write Mermaid.</p>`;
      return;
    }
    preview.innerHTML = `<p class="md-mermaid-empty">Rendering…</p>`;
    try {
      const svg = await renderMermaidSvg(text);
      if (token !== renderToken) return;
      preview.innerHTML = svg;
    } catch (error) {
      if (token !== renderToken) return;
      const message = error instanceof Error ? error.message : "Invalid Mermaid diagram";
      preview.classList.add("is-error");
      preview.innerHTML = `<p class="md-mermaid-error">${message.replace(/</g, "&lt;")}</p><pre class="mermaid">${text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")}</pre>`;
    }
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
    applySource(textarea.value);
    showPreview();
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
      applySource(textarea.value);
      showPreview();
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

  void render(String(current.attrs.source ?? ""));

  return {
    dom,
    update(updated) {
      if (updated.type.name !== "mermaid") return false;
      const next = String(updated.attrs.source ?? "");
      const prev = String(current.attrs.source ?? "");
      current = updated;
      if (!editing && next !== prev) void render(next);
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
      renderToken += 1;
    }
  };
}

import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { TableMap, columnResizingPluginKey } from "prosemirror-tables";
import { isColumnResizeIntent } from "./tableDom";

type Dragging = { startX: number; startWidth: number };

function getPageScale(view: EditorView, target: EventTarget | null): number {
  const root = target instanceof Element ? target : view.dom;
  const frame = root.closest(".page-frame") as HTMLElement | null;
  if (!frame) return 1;
  const scale = parseFloat(getComputedStyle(frame).getPropertyValue("--page-scale").trim());
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function currentColWidth(view: EditorView, cellPos: number, attrs: { colspan: number; colwidth?: number[] | null }) {
  const { colspan, colwidth } = attrs;
  const width = colwidth && colwidth[colwidth.length - 1];
  if (width) return width;
  const dom = view.domAtPos(cellPos);
  const cellDom = dom.node.childNodes[dom.offset] as HTMLElement;
  let domWidth = cellDom.offsetWidth;
  let parts = colspan;
  if (colwidth) {
    for (let i = 0; i < colspan; i++) {
      const part = colwidth[i];
      if (part) {
        domWidth -= part;
        parts--;
      }
    }
  }
  return domWidth / parts;
}

function displayColumnWidth(
  view: EditorView,
  cell: number,
  width: number,
  defaultCellMinWidth: number
) {
  const $cell = view.state.doc.resolve(cell);
  const table = $cell.node(-1);
  const start = $cell.start(-1);
  const col = TableMap.get(table).colCount($cell.pos - start) + $cell.nodeAfter!.attrs.colspan - 1;
  let dom: Node | null = view.domAtPos($cell.start(-1)).node;
  while (dom && (dom as HTMLElement).nodeName !== "TABLE") dom = dom.parentNode;
  if (!dom) return;
  const tableEl = dom as HTMLTableElement;
  updateTableColumnsOnResize(table, tableEl.querySelector("colgroup"), tableEl, defaultCellMinWidth, col, width);
}

function updateTableColumnsOnResize(
  node: import("@tiptap/pm/model").Node,
  colgroup: HTMLTableColElement | null,
  table: HTMLTableElement,
  defaultCellMinWidth: number,
  overrideCol: number,
  overrideValue: number
) {
  if (!colgroup) return;
  let totalWidth = 0;
  let fixedWidth = true;
  let nextDOM = colgroup.firstChild;
  const row = node.firstChild;
  if (!row) return;
  for (let i = 0, col = 0; i < row.childCount; i++) {
    const { colspan, colwidth } = row.child(i).attrs;
    for (let j = 0; j < colspan; j++, col++) {
      const hasWidth = overrideCol === col ? overrideValue : colwidth && colwidth[j];
      const cssWidth = hasWidth ? `${hasWidth}px` : "";
      totalWidth += hasWidth || defaultCellMinWidth;
      if (!hasWidth) fixedWidth = false;
      if (!nextDOM) {
        const colEl = document.createElement("col");
        colEl.style.width = cssWidth;
        colgroup.appendChild(colEl);
      } else {
        if ((nextDOM as HTMLElement).style.width !== cssWidth) {
          (nextDOM as HTMLElement).style.width = cssWidth;
        }
        nextDOM = nextDOM.nextSibling;
      }
    }
  }
  while (nextDOM) {
    const after = nextDOM.nextSibling;
    nextDOM.parentNode?.removeChild(nextDOM);
    nextDOM = after;
  }
  if (fixedWidth) {
    table.style.width = `${totalWidth}px`;
    table.style.minWidth = "";
  } else {
    table.style.width = "";
    table.style.minWidth = `${totalWidth}px`;
  }
}

function updateColumnWidth(view: EditorView, cell: number, width: number) {
  const $cell = view.state.doc.resolve(cell);
  const table = $cell.node(-1);
  const map = TableMap.get(table);
  const start = $cell.start(-1);
  const col = map.colCount($cell.pos - start) + $cell.nodeAfter!.attrs.colspan - 1;
  const tr = view.state.tr;
  for (let row = 0; row < map.height; row++) {
    const mapIndex = row * map.width + col;
    if (row && map.map[mapIndex] === map.map[mapIndex - map.width]) continue;
    const pos = map.map[mapIndex];
    if (pos == null) continue;
    const attrs = table.nodeAt(pos)!.attrs;
    const index = attrs.colspan === 1 ? 0 : col - map.colCount(pos);
    if (attrs.colwidth && attrs.colwidth[index] === width) continue;
    const colwidth = attrs.colwidth ? attrs.colwidth.slice() : zeroes(Number(attrs.colspan ?? 1));
    colwidth[index] = width;
    tr.setNodeMarkup(start + pos, undefined, { ...attrs, colwidth });
  }
  if (tr.docChanged) view.dispatch(tr);
}

function zeroes(n: number) {
  return Array(n).fill(0);
}

function draggedWidth(dragging: Dragging, event: MouseEvent, resizeMinWidth: number, scale: number) {
  const offset = (event.clientX - dragging.startX) / scale;
  return Math.max(resizeMinWidth, dragging.startWidth + offset);
}

function handleScaledMouseDown(
  view: EditorView,
  event: MouseEvent,
  scale: number,
  cellMinWidth: number,
  defaultCellMinWidth: number
): boolean {
  if (!view.editable) return false;
  const win = view.dom.ownerDocument.defaultView ?? window;
  const pluginState = columnResizingPluginKey.getState(view.state);
  if (!pluginState || pluginState.activeHandle === -1 || pluginState.dragging) return false;
  const cell = view.state.doc.nodeAt(pluginState.activeHandle);
  if (!cell) return false;
  const width = currentColWidth(view, pluginState.activeHandle, {
    colspan: Number(cell.attrs.colspan ?? 1),
    colwidth: Array.isArray(cell.attrs.colwidth) ? cell.attrs.colwidth : null
  });
  view.dispatch(
    view.state.tr.setMeta(columnResizingPluginKey, {
      setDragging: { startX: event.clientX, startWidth: width }
    })
  );

  function finish(event: MouseEvent) {
    win.removeEventListener("mouseup", finish);
    win.removeEventListener("mousemove", move);
    const state = columnResizingPluginKey.getState(view.state);
    if (state?.dragging) {
      updateColumnWidth(view, state.activeHandle, draggedWidth(state.dragging, event, cellMinWidth, scale));
      view.dispatch(view.state.tr.setMeta(columnResizingPluginKey, { setDragging: null }));
    }
  }

  function move(event: MouseEvent) {
    if (!event.buttons) return finish(event);
    const state = columnResizingPluginKey.getState(view.state);
    if (!state?.dragging) return;
    displayColumnWidth(
      view,
      state.activeHandle,
      draggedWidth(state.dragging, event, cellMinWidth, scale),
      defaultCellMinWidth
    );
  }

  displayColumnWidth(view, pluginState.activeHandle, width, defaultCellMinWidth);
  win.addEventListener("mouseup", finish);
  win.addEventListener("mousemove", move);
  event.preventDefault();
  return true;
}

/** Compensates page zoom (`transform: scale`) so column drag tracks the cursor. */
export function scaledColumnResizeFix(options: {
  cellMinWidth: number;
  defaultCellMinWidth: number;
}): Plugin {
  return new Plugin({
    key: new PluginKey("scaledColumnResizeFix"),
    props: {
      handleDOMEvents: {
        mousedown(view, event) {
          const scale = getPageScale(view, event.target);
          if (scale === 1) return false;
          if (!isColumnResizeIntent(view, event)) return false;
          return handleScaledMouseDown(view, event, scale, options.cellMinWidth, options.defaultCellMinWidth);
        }
      }
    }
  });
}

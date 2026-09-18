import { Plugin, PluginKey } from "@tiptap/pm/state";
import { columnResizingPluginKey } from "prosemirror-tables";
import { isColumnResizeIntent } from "./tableDom";

/**
 * Column resize keeps `activeHandle` after hover near an edge. The resize plugin
 * then consumes the next mousedown anywhere in the table, which blocks text and
 * cell selection. Clear the stale handle unless the click is actually on an edge.
 */
export function tableSelectionFix(options: { handleWidth?: number } = {}): Plugin {
  const handleWidth = options.handleWidth ?? 5;
  return new Plugin({
    key: new PluginKey("tableSelectionFix"),
    props: {
      handleDOMEvents: {
        mousedown(view, event) {
          if (event.button !== 0) return false;
          if (isColumnResizeIntent(view, event, handleWidth)) return false;
          const resize = columnResizingPluginKey.getState(view.state);
          if (resize && resize.activeHandle > -1 && !resize.dragging) {
            view.dispatch(view.state.tr.setMeta(columnResizingPluginKey, { setHandle: -1 }));
          }
          return false;
        }
      }
    }
  });
}

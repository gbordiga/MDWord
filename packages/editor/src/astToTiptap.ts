import type { GenericNode } from "@mdword/shared";
import { decodeWikiHref, WIKI_SCHEME } from "@mdword/shared";

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

function textNode(text: string, marks?: TiptapNode["marks"]): TiptapNode {
  return { type: "text", text, marks };
}

function withMarks(nodes: TiptapNode[], mark: { type: string; attrs?: Record<string, unknown> }): TiptapNode[] {
  return nodes.map((n) => {
    if (n.type === "text") {
      return { ...n, marks: [...(n.marks ?? []), mark] };
    }
    if (n.content) {
      return { ...n, content: withMarks(n.content, mark) };
    }
    return n;
  });
}

function inline(nodes: GenericNode[] | undefined): TiptapNode[] {
  const out: TiptapNode[] = [];
  for (const node of nodes ?? []) {
    switch (node.type) {
      case "text":
        out.push(textNode(String(node.value ?? "")));
        break;
      case "strong":
        out.push(...withMarks(inline(node.children), { type: "bold" }));
        break;
      case "emphasis":
        out.push(...withMarks(inline(node.children), { type: "italic" }));
        break;
      case "delete":
      case "strikethrough":
        out.push(...withMarks(inline(node.children), { type: "strike" }));
        break;
      case "inlineCode":
        out.push(textNode(String(node.value ?? ""), [{ type: "code" }]));
        break;
      case "break":
        out.push({ type: "hardBreak" });
        break;
      case "link": {
        const url = String(node.url ?? "");
        if (url.startsWith(WIKI_SCHEME)) {
          const wiki = decodeWikiHref(url);
          const label = inline(node.children)
            .map((n) => n.text)
            .filter(Boolean)
            .join("");
          out.push({
            type: "wikiLink",
            attrs: {
              target: wiki?.target ?? "",
              section: wiki?.section ?? null,
              label: label || wiki?.target
            }
          });
        } else {
          out.push(...withMarks(inline(node.children), { type: "link", attrs: { href: url } }));
        }
        break;
      }
      case "image":
        out.push({
          type: "image",
          attrs: { src: node.url, alt: node.alt ?? "" }
        });
        break;
      default:
        if (node.children) out.push(...inline(node.children));
        else if (node.value) out.push(textNode(String(node.value)));
    }
  }
  return out.length ? out : [textNode("")];
}

function block(node: GenericNode): TiptapNode | TiptapNode[] {
  switch (node.type) {
    case "paragraph":
      return { type: "paragraph", content: inline(node.children) };
    case "heading":
      return {
        type: "heading",
        attrs: { level: Number(node.depth ?? 1) },
        content: inline(node.children)
      };
    case "blockquote":
      return { type: "blockquote", content: blocks(node.children) };
    case "list": {
      const ordered = Boolean(node.ordered);
      const tasks = node.children?.some((c) => c.checked !== undefined);
      return {
        type: tasks ? "taskList" : ordered ? "orderedList" : "bulletList",
        content: (node.children ?? []).map((item) => ({
          type: tasks ? "taskItem" : "listItem",
          attrs: tasks ? { checked: Boolean(item.checked) } : undefined,
          content: blocks(item.children)
        }))
      };
    }
    case "code":
    case "codeBlock":
      return {
        type: "codeBlock",
        attrs: { language: node.lang ?? null },
        content: node.value ? [textNode(String(node.value))] : []
      };
    case "thematicBreak":
      return { type: "horizontalRule" };
    case "table":
      return {
        type: "table",
        content: (node.children ?? []).map((row, rowIndex) => ({
          type: "tableRow",
          content: (row.children ?? []).map((cell) => ({
            type: rowIndex === 0 || cell.header ? "tableHeader" : "tableCell",
            content: cell.children?.length
              ? blocks(cell.children)
              : [{ type: "paragraph", content: inline(cell.children) }]
          }))
        }))
      };
    case "admonition":
      return {
        type: "callout",
        attrs: { kind: node.kind ?? "note" },
        content: blocks(node.children)
      };
    case "mystDirective": {
      const name = String(node.name ?? "");
      if (name === "page-break") return { type: "pageBreak" };
      const callouts = ["note", "tip", "warning", "important", "caution", "danger", "error", "hint"];
      if (callouts.includes(name)) {
        return {
          type: "callout",
          attrs: { kind: name },
          content: blocks(node.children).length
            ? blocks(node.children)
            : [{ type: "paragraph", content: [textNode(String(node.value ?? ""))] }]
        };
      }
      if (name === "figure") {
        return figureFromDirective(node);
      }
      return {
        type: "mystRaw",
        attrs: {
          name,
          source: node.value ?? `::: {${name}}\n${node.value ?? ""}\n:::`
        }
      };
    }
    case "image":
      return {
        type: "paragraph",
        content: [{ type: "image", attrs: { src: node.url, alt: node.alt ?? "" } }]
      };
    default:
      if (node.children) return blocks(node.children);
      return { type: "paragraph", content: [textNode(String(node.value ?? ""))] };
  }
}

function figureFromDirective(node: GenericNode): TiptapNode {
  const image = node.children?.find((c) => c.type === "image");
  const captionNodes = (node.children ?? []).filter((c) => c.type !== "image");
  const content: TiptapNode[] = [];
  if (image) {
    content.push({ type: "image", attrs: { src: image.url, alt: image.alt ?? "" } });
  }
  if (captionNodes.length) {
    content.push({ type: "caption", content: inline(captionNodes) });
  }
  return {
    type: "figure",
    attrs: { label: (node.options as { label?: string } | undefined)?.label ?? null },
    content
  };
}

function blocks(nodes: GenericNode[] | undefined): TiptapNode[] {
  const out: TiptapNode[] = [];
  for (const node of nodes ?? []) {
    const rendered = block(node);
    if (Array.isArray(rendered)) out.push(...rendered);
    else out.push(rendered);
  }
  return out.length ? out : [{ type: "paragraph" }];
}

export function astToTiptap(ast: GenericNode): TiptapNode {
  return { type: "doc", content: blocks(ast.children) };
}

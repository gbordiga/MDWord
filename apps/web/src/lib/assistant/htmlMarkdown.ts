import { imageReference } from "@mdword/shared";

/**
 * HTML to Markdown for the HTML that mammoth produces from a docx: headings,
 * paragraphs, bold, italic, links, nested lists, tables, quotes, code, pictures.
 * It scans the text once (no backtracking patterns), so a hostile file cannot
 * make it slow, and it never keeps a tag, script, or style it does not know.
 */

type Token =
  | { kind: "text"; text: string }
  | { kind: "open"; name: string; attrs: string; selfClose: boolean }
  | { kind: "close"; name: string };

const DROP = new Set(["script", "style", "noscript", "template", "head", "title"]);
const VOID = new Set(["br", "img", "hr", "input", "meta", "link", "col", "wbr"]);

const ENTITIES: Record<string, string> = {
  nbsp: " ",
  lt: "<",
  gt: ">",
  quot: '"',
  amp: "&",
  apos: "'",
  hellip: "\u2026",
  mdash: "\u2014",
  ndash: "\u2013",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201c",
  rdquo: "\u201d",
  euro: "\u20ac",
  copy: "\u00a9"
};

export function decodeEntities(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const amp = text.indexOf("&", i);
    if (amp < 0) {
      out += text.slice(i);
      break;
    }
    out += text.slice(i, amp);
    const semi = text.indexOf(";", amp + 1);
    if (semi < 0 || semi - amp > 10) {
      out += "&";
      i = amp + 1;
      continue;
    }
    const name = text.slice(amp + 1, semi);
    let value: string | undefined;
    if (name.startsWith("#")) {
      const hex = name[1] === "x" || name[1] === "X";
      const digits = name.slice(hex ? 2 : 1);
      const code = digits !== "" && /^[0-9a-f]+$/i.test(digits) ? Number.parseInt(digits, hex ? 16 : 10) : Number.NaN;
      if (Number.isInteger(code) && code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)) {
        value = String.fromCodePoint(code);
      }
    } else {
      value = ENTITIES[name];
    }
    if (value === undefined) {
      out += "&";
      i = amp + 1;
    } else {
      out += value;
      i = semi + 1;
    }
  }
  return out;
}

function isLetter(ch: string | undefined): boolean {
  return ch !== undefined && ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z"));
}

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  const lower = html.toLowerCase();
  let i = 0;
  let text = "";
  const pushText = () => {
    if (text) tokens.push({ kind: "text", text });
    text = "";
  };
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) {
      text += html.slice(i);
      break;
    }
    text += html.slice(i, lt);
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      i = end < 0 ? html.length : end + 3;
      continue;
    }
    const closing = html[lt + 1] === "/";
    const nameStart = lt + (closing ? 2 : 1);
    if (!isLetter(html[nameStart])) {
      if (html[lt + 1] === "!" || html[lt + 1] === "?") {
        const end = html.indexOf(">", lt + 1);
        i = end < 0 ? html.length : end + 1;
      } else {
        text += "<";
        i = lt + 1;
      }
      continue;
    }
    let nameEnd = nameStart;
    while (nameEnd < html.length && /[a-z0-9:-]/i.test(html[nameEnd]!)) nameEnd += 1;
    const name = lower.slice(nameStart, nameEnd);
    // Attributes run to the next `>` that is not inside quotes.
    let end = nameEnd;
    let quote = "";
    while (end < html.length) {
      const ch = html[end]!;
      if (quote) {
        if (ch === quote) quote = "";
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === ">") break;
      end += 1;
    }
    const attrs = html.slice(nameEnd, Math.min(end, html.length));
    i = end < html.length ? end + 1 : html.length;
    pushText();
    if (closing) {
      tokens.push({ kind: "close", name });
      continue;
    }
    const selfClose = attrs.trimEnd().endsWith("/") || VOID.has(name);
    if (DROP.has(name) && !selfClose) {
      const close = lower.indexOf("</" + name, i);
      if (close < 0) {
        i = html.length;
      } else {
        const gt = html.indexOf(">", close);
        i = gt < 0 ? html.length : gt + 1;
      }
      continue;
    }
    tokens.push({ kind: "open", name, attrs, selfClose });
  }
  pushText();
  return tokens;
}

function attribute(attrs: string, name: string): string {
  const lower = attrs.toLowerCase();
  let from = 0;
  while (from < attrs.length) {
    const at = lower.indexOf(name, from);
    if (at < 0) return "";
    from = at + name.length;
    const before = at === 0 ? " " : attrs[at - 1]!;
    if (!/\s/.test(before) && before !== '"' && before !== "'") continue;
    let j = from;
    while (j < attrs.length && /\s/.test(attrs[j]!)) j += 1;
    if (attrs[j] !== "=") continue;
    j += 1;
    while (j < attrs.length && /\s/.test(attrs[j]!)) j += 1;
    const q = attrs[j];
    if (q === '"' || q === "'") {
      const close = attrs.indexOf(q, j + 1);
      return decodeEntities(attrs.slice(j + 1, close < 0 ? attrs.length : close));
    }
    let k = j;
    while (k < attrs.length && !/\s/.test(attrs[k]!)) k += 1;
    return decodeEntities(attrs.slice(j, k));
  }
  return "";
}

function collapse(text: string): string {
  return text.replace(/[ \t\r\n\f]+/g, " ");
}

function safeHref(href: string): boolean {
  const value = href.trim().toLowerCase();
  return value !== "" && !value.startsWith("javascript:") && !value.startsWith("data:") && !value.startsWith("vbscript:");
}

/** Close an emphasis mark; trailing spaces go outside it, which Markdown requires. */
function closeMark(text: string, mark: string): string {
  const trimmed = text.trimEnd();
  return `${trimmed}${mark}${text.slice(trimmed.length)}`;
}

function cellText(text: string): string {
  return text.trim().replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
}

function renderTable(rows: string[][]): string {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  if (width === 0) return "";
  const line = (row: string[]) => `| ${Array.from({ length: width }, (_, i) => row[i] ?? "").join(" | ")} |`;
  const [head = [], ...body] = rows;
  return [line(head), `| ${Array.from({ length: width }, () => "---").join(" | ")} |`, ...body.map(line)].join("\n");
}

interface Block {
  text: string;
  tight: boolean;
}

export function htmlToMarkdown(html: string): string {
  const tokens = tokenize(html);
  const definitions = new Map<string, string>();
  const blocks: Block[] = [];
  let cur = "";
  let heading = 0;
  let quote = 0;
  let pre = false;
  let item: { marker: string; indent: string } | null = null;
  const lists: { ordered: boolean; n: number; width: number }[] = [];
  const links: { href: string; start: number }[] = [];
  let tableDepth = 0;
  let rows: string[][] = [];
  let row: string[] = [];
  let inCell = false;

  const quoted = (text: string) =>
    quote > 0
      ? text
          .split("\n")
          .map((line) => `${"> ".repeat(quote)}${line}`)
          .join("\n")
      : text;

  const flush = () => {
    if (inCell) return;
    let text = cur;
    cur = "";
    if (pre) {
      if (text.trim() === "") return;
      blocks.push({ text: quoted("```\n" + text.replace(/^\n+|\n+$/g, "") + "\n```"), tight: false });
      return;
    }
    text = text
      .replace(/\*\*\*\*/g, "")
      .replace(/ +\n/g, "\n")
      .trim();
    if (text === "" || text === "**" || text === "*") return;
    if (heading > 0) {
      blocks.push({ text: quoted(`${"#".repeat(heading)} ${text.replace(/\s*\n\s*/g, " ")}`), tight: false });
    } else if (item) {
      const body = text.replace(/\n/g, `\n${item.indent}  `);
      const current = item;
      item = { marker: "", indent: current.indent };
      blocks.push({ text: quoted(`${current.indent}${current.marker}${body}`), tight: true });
    } else {
      blocks.push({ text: quoted(text), tight: false });
    }
  };

  const picture = (attrs: string) => {
    const src = attribute(attrs, "src");
    if (!src.startsWith("data:image/") || src.startsWith("data:image/svg")) return "";
    const alt = (attribute(attrs, "alt") || "image").replace(/[[\]]/g, "") || "image";
    const ref = imageReference(alt, src);
    definitions.set(ref.id, ref.definition);
    return ref.image;
  };

  for (const token of tokens) {
    if (token.kind === "text") {
      if (!pre && inCell === false && cur === "" && token.text.trim() === "") continue;
      cur += pre ? decodeEntities(token.text) : collapse(decodeEntities(token.text));
      continue;
    }
    const { name } = token;
    if (token.kind === "open") {
      if (name === "br") {
        cur += pre || heading > 0 || inCell ? "\n" : "  \n";
      } else if (name === "img") {
        cur += picture(token.attrs);
      } else if (name === "hr") {
        flush();
        blocks.push({ text: "---", tight: false });
      } else if (/^h[1-6]$/.test(name)) {
        flush();
        heading = Number(name[1]);
      } else if (name === "p" || name === "div" || name === "section" || name === "article") {
        flush();
      } else if (name === "blockquote") {
        flush();
        quote += 1;
      } else if (name === "pre") {
        flush();
        pre = true;
      } else if (name === "ul" || name === "ol") {
        flush();
        const parent = lists[lists.length - 1];
        lists.push({ ordered: name === "ol", n: 0, width: (parent?.width ?? 0) + (name === "ol" ? 3 : 2) });
      } else if (name === "li") {
        flush();
        const list = lists[lists.length - 1];
        if (list) {
          list.n += 1;
          const depth = lists.length - 1;
          const indent = depth > 0 ? " ".repeat(lists[depth - 1]!.width) : "";
          item = { marker: list.ordered ? `${list.n}. ` : "- ", indent };
        } else {
          item = { marker: "- ", indent: "" };
        }
      } else if (name === "table") {
        tableDepth += 1;
        if (tableDepth === 1) {
          flush();
          rows = [];
          row = [];
        }
      } else if ((name === "td" || name === "th") && tableDepth === 1) {
        cur = "";
        inCell = true;
      } else if (name === "a") {
        links.push({ href: attribute(token.attrs, "href"), start: cur.length });
      } else if (name === "strong" || name === "b") {
        cur += "**";
      } else if (name === "em" || name === "i") {
        cur += "*";
      } else if (name === "code" && !pre) {
        cur += "`";
      } else if (name === "tr" && tableDepth === 1) {
        row = [];
      }
      continue;
    }
    // Closing tags.
    if (/^h[1-6]$/.test(name)) {
      flush();
      heading = 0;
    } else if (name === "p" || name === "div" || name === "section" || name === "article") {
      flush();
    } else if (name === "blockquote") {
      flush();
      quote = Math.max(0, quote - 1);
    } else if (name === "pre") {
      flush();
      pre = false;
    } else if (name === "li") {
      flush();
      item = null;
    } else if (name === "ul" || name === "ol") {
      flush();
      lists.pop();
      item = null;
    } else if ((name === "td" || name === "th") && tableDepth === 1) {
      row.push(cellText(cur));
      cur = "";
      inCell = false;
    } else if (name === "tr" && tableDepth === 1) {
      if (row.length > 0) rows.push(row);
      row = [];
    } else if (name === "table") {
      if (tableDepth === 1) {
        if (row.length > 0) rows.push(row);
        const text = renderTable(rows);
        if (text) blocks.push({ text: quoted(text), tight: false });
        rows = [];
        row = [];
        inCell = false;
        cur = "";
      }
      tableDepth = Math.max(0, tableDepth - 1);
    } else if (name === "a") {
      const link = links.pop();
      if (link && safeHref(link.href)) {
        const label = cur.slice(link.start).trim();
        if (label !== "") cur = `${cur.slice(0, link.start)}[${label}](${link.href.trim().replace(/\)/g, "%29")})`;
      }
    } else if (name === "strong" || name === "b") {
      cur = closeMark(cur, "**");
    } else if (name === "em" || name === "i") {
      cur = closeMark(cur, "*");
    } else if (name === "code" && !pre) {
      cur = closeMark(cur, "`");
    }
  }
  flush();

  let body = "";
  blocks.forEach((block, index) => {
    const last = blocks[index - 1];
    body += index === 0 ? block.text : `${last?.tight && block.tight ? "\n" : "\n\n"}${block.text}`;
  });
  const defs = [...definitions.values()].join("\n");
  return `${body}${defs ? `\n\n${defs}` : ""}`.replace(/\n{3,}/g, "\n\n").trim();
}

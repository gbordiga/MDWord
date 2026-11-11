import { decodeEntities } from "./htmlMarkdown";

/**
 * One slide of a pptx as Markdown, from its XML: the title placeholder becomes
 * the heading, paragraphs keep their bullet level, tables become tables, and
 * speaker notes follow as a quote. Elements are found by scanning, not by
 * backtracking patterns, so a hostile file cannot make this slow.
 */

interface Element {
  name: string;
  /** Opening tag text, between `<` and `>`. */
  open: string;
  body: string;
}

function startsTag(xml: string, at: number, name: string): boolean {
  if (!xml.startsWith("<" + name, at)) return false;
  const next = xml[at + name.length + 1];
  return next === ">" || next === "/" || next === " " || next === "\n" || next === "\t" || next === "\r";
}

/** Top-level elements with one of these names, in document order. Matching elements are not searched inside. */
export function scan(xml: string, names: readonly string[]): Element[] {
  const out: Element[] = [];
  let i = 0;
  while (i < xml.length) {
    const lt = xml.indexOf("<", i);
    if (lt < 0) break;
    const name = names.find((n) => startsTag(xml, lt, n));
    if (!name) {
      i = lt + 1;
      continue;
    }
    const gt = xml.indexOf(">", lt);
    if (gt < 0) break;
    const open = xml.slice(lt + 1, gt);
    if (open.endsWith("/")) {
      out.push({ name, open, body: "" });
      i = gt + 1;
      continue;
    }
    const closeTag = `</${name}>`;
    const close = xml.indexOf(closeTag, gt + 1);
    if (close < 0) break;
    out.push({ name, open, body: xml.slice(gt + 1, close) });
    i = close + closeTag.length;
  }
  return out;
}

function attr(open: string, name: string): string {
  const key = ` ${name}="`;
  const at = open.indexOf(key);
  if (at < 0) return "";
  const from = at + key.length;
  const end = open.indexOf('"', from);
  return end < 0 ? "" : open.slice(from, end);
}

function textOf(paragraph: string): string {
  let text = "";
  for (const part of scan(paragraph, ["a:r", "a:br"])) {
    if (part.name === "a:br") {
      text += " ";
      continue;
    }
    for (const t of scan(part.body, ["a:t"])) text += decodeEntities(t.body);
  }
  return text.replace(/\s+/g, " ").trim();
}

interface Line {
  text: string;
  bullet: string | null;
  level: number;
}

function placeholder(shape: string): { type: string; present: boolean } {
  const ph = scan(shape, ["p:ph"])[0];
  return ph ? { type: attr(ph.open, "type"), present: true } : { type: "", present: false };
}

function tableRows(frame: string): string[][] {
  const rows: string[][] = [];
  for (const tr of scan(frame, ["a:tr"])) {
    const cells = scan(tr.body, ["a:tc"]).map((tc) =>
      scan(tc.body, ["a:p"])
        .map((p) => textOf(p.body))
        .filter(Boolean)
        .join(" ")
        .replace(/\\/g, "\\\\")
        .replace(/\|/g, "\\|")
    );
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

function renderTable(rows: string[][]): string {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const line = (row: string[]) => `| ${Array.from({ length: width }, (_, i) => row[i] ?? "").join(" | ")} |`;
  const [head = [], ...body] = rows;
  return [line(head), `| ${Array.from({ length: width }, () => "---").join(" | ")} |`, ...body.map(line)].join("\n");
}

function render(lines: Line[]): string {
  const out: string[] = [];
  let previousBullet = false;
  for (const line of lines) {
    const text = line.bullet ? `${"  ".repeat(line.level)}${line.bullet} ${line.text}` : line.text;
    out.push(out.length === 0 ? text : `${previousBullet && line.bullet ? "\n" : "\n\n"}${text}`);
    previousBullet = Boolean(line.bullet);
  }
  return out.join("");
}

export function slideToMarkdown(xml: string, number: number, notesXml?: string): string {
  let title = "";
  const blocks: string[] = [];
  const shapes = scan(xml, ["p:sp", "p:graphicFrame"]);
  for (const shape of shapes) {
    if (shape.name === "p:graphicFrame") {
      const rows = tableRows(shape.body);
      if (rows.length > 0) blocks.push(renderTable(rows));
      continue;
    }
    const ph = placeholder(shape.body);
    if (["dt", "ftr", "sldNum", "hdr"].includes(ph.type)) continue;
    const isTitle = ph.type === "title" || ph.type === "ctrTitle";
    const isBody = ph.present && !isTitle && ph.type !== "subTitle";
    const lines: Line[] = [];
    for (const p of scan(shape.body, ["a:p"])) {
      const text = textOf(p.body);
      if (!text) continue;
      const props = scan(p.body, ["a:pPr"])[0];
      const level = Number(attr(props?.open ?? "", "lvl")) || 0;
      const none = props ? props.body.includes("<a:buNone") : false;
      const numbered = props ? props.body.includes("<a:buAutoNum") : false;
      const marked = props ? props.body.includes("<a:buChar") || numbered : false;
      const bullet = isTitle || none ? null : numbered ? "1." : marked || isBody ? "-" : null;
      lines.push({ text, bullet, level: Math.min(level, 6) });
    }
    if (lines.length === 0) continue;
    if (isTitle && !title) {
      title = lines.map((l) => l.text).join(" ");
      continue;
    }
    blocks.push(render(lines));
  }
  if (shapes.length === 0) {
    // Not a normal slide: keep every run of text so nothing is lost.
    const text = scan(xml, ["a:t"]).map((t) => decodeEntities(t.body));
    if (text.length > 0) blocks.push(text.join("\n"));
  }
  if (notesXml) {
    const notes: string[] = [];
    for (const shape of scan(notesXml, ["p:sp"])) {
      if (placeholder(shape.body).type !== "body") continue;
      for (const p of scan(shape.body, ["a:p"])) {
        const text = textOf(p.body);
        if (text) notes.push(text);
      }
    }
    if (notes.length > 0) blocks.push(notes.map((n) => `> ${n}`).join("\n>\n").replace(/^> /, "> Notes: "));
  }
  return [`## Slide ${number}${title ? `: ${title}` : ""}`, ...blocks].join("\n\n");
}

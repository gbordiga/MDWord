/**
 * PDF text with positions to Markdown. A PDF has no paragraphs or headings, only
 * pieces of text at coordinates, so this rebuilds them from the layout: lines by
 * height, headings by font size, paragraphs by line spacing, lists by their
 * markers, and it drops headers, footers, and page numbers that repeat.
 */

export interface PdfItem {
  text: string;
  x: number;
  y: number;
  size: number;
  /** Drawn width, when the PDF reader gives it. */
  width?: number;
}

interface Line {
  text: string;
  y: number;
  size: number;
  x: number;
  page: number;
  /** Page position, 0 at the top and 1 at the bottom. */
  band: number;
}

const BULLET = /^[•▪●◦‣·\-–*]\s+/;
const NUMBERED = /^(\d{1,3}[.)]|[a-z][.)])\s+/;

/** The font size that covers the most characters on the line, without one entry per character. */
function dominantSize(items: PdfItem[]): number {
  const weight = new Map<number, number>();
  for (const item of items) {
    const key = Math.round(item.size * 2) / 2;
    weight.set(key, (weight.get(key) ?? 0) + Math.max(1, item.text.trim().length));
  }
  let best = items[0]?.size ?? 0;
  let most = -1;
  for (const [size, count] of weight) {
    if (count > most) {
      most = count;
      best = size;
    }
  }
  return best;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function pageLines(items: PdfItem[], page: number): Line[] {
  const useful = items.filter((item) => item.text.trim() !== "");
  if (useful.length === 0) return [];
  const sorted = [...useful].sort((a, b) => b.y - a.y || a.x - b.x);
  const groups: PdfItem[][] = [];
  for (const item of sorted) {
    const group = groups[groups.length - 1];
    const first = group?.[0];
    if (group && first && Math.abs(first.y - item.y) <= Math.max(1, Math.min(first.size, item.size) * 0.4)) group.push(item);
    else groups.push([item]);
  }
  // A loop, not a spread: a dense page can hold more items than a function call accepts.
  let top = useful[0]!.y;
  let bottom = top;
  for (const item of useful) {
    if (item.y > top) top = item.y;
    if (item.y < bottom) bottom = item.y;
  }
  const span = Math.max(1, top - bottom);
  return groups.map((group) => {
    group.sort((a, b) => a.x - b.x);
    let text = "";
    let end = Number.NaN;
    for (const item of group) {
      const gap = item.x - end;
      const needsSpace = text !== "" && !text.endsWith(" ") && !item.text.startsWith(" ") && !(gap < item.size * 0.15);
      text += (needsSpace ? " " : "") + item.text;
      end = item.x + (item.width ?? item.text.length * item.size * 0.5);
    }
    const y = group[0]!.y;
    return {
      text: text.replace(/\s+/g, " ").trim(),
      y,
      size: dominantSize(group),
      x: group[0]!.x,
      page,
      band: (top - y) / span
    };
  });
}

function normalised(text: string): string {
  return text.replace(/\d+/g, "#").toLowerCase();
}

/** Lines that sit at the top or bottom of most pages with the same words are page furniture. */
function furniture(pages: Line[][]): Set<string> {
  const counts = new Map<string, number>();
  for (const lines of pages) {
    const seen = new Set<string>();
    for (const line of lines) {
      if (line.band > 0.12 && line.band < 0.88) continue;
      seen.add(normalised(line.text));
    }
    for (const key of seen) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const need = Math.max(3, Math.ceil(pages.length * 0.5));
  return new Set([...counts].filter(([, n]) => n >= need).map(([key]) => key));
}

export function pdfToMarkdown(pages: PdfItem[][]): string {
  const lined = pages.map((items, index) => pageLines(items, index + 1));
  const repeated = pages.length >= 3 ? furniture(lined) : new Set<string>();
  const lines = lined.flat().filter((line) => {
    if (/^(page\s+)?\d{1,4}(\s*(\/|of)\s*\d{1,4})?$/i.test(line.text) && (line.band < 0.12 || line.band > 0.88)) return false;
    return !(repeated.has(normalised(line.text)) && (line.band < 0.12 || line.band > 0.88));
  });
  if (lines.length === 0) return "";

  const weight = new Map<number, number>();
  for (const line of lines) {
    const key = Math.round(line.size * 2) / 2;
    weight.set(key, (weight.get(key) ?? 0) + line.text.length);
  }
  const body = [...weight].sort((a, b) => b[1] - a[1])[0]![0];
  const larger = [...weight.keys()].filter((size) => size >= body * 1.15).sort((a, b) => b - a);
  const levelOf = (size: number): number => {
    const key = Math.round(size * 2) / 2;
    const rank = larger.indexOf(key);
    return rank < 0 ? 0 : Math.min(rank + 1, 4);
  };
  const spacing = median(
    lines
      .map((line, i) => {
        const before = lines[i - 1];
        const plain = (l: Line) => levelOf(l.size) === 0;
        return before && before.page === line.page && plain(before) && plain(line) ? before.y - line.y : 0;
      })
      .filter((gap) => gap > 0 && gap < body * 4)
  );
  const leftMargin = median(lines.map((line) => line.x));

  const out: string[] = [];
  let paragraph = "";
  let inList = false;
  const endParagraph = () => {
    if (paragraph) out.push(paragraph);
    paragraph = "";
    inList = false;
  };
  const join = (left: string, right: string) => {
    if (/[A-Za-zÀ-ÿ]-$/.test(left) && /^[a-zà-ÿ]/.test(right)) return left.slice(0, -1) + right;
    return `${left} ${right}`;
  };

  lines.forEach((line, i) => {
    const previous = lines[i - 1];
    const level = levelOf(line.size);
    if (level > 0 && line.text.length <= 140) {
      endParagraph();
      const last = out[out.length - 1];
      const mark = "#".repeat(Math.min(level, 4));
      // A heading that wraps onto a second line of the same size stays one heading.
      if (previous && previous.page === line.page && levelOf(previous.size) === level && last?.startsWith(mark + " ") && previous.y - line.y < line.size * 1.6) {
        out[out.length - 1] = join(last, line.text);
      } else out.push(`${mark} ${line.text}`);
      return;
    }
    const gap = previous && previous.page === line.page ? previous.y - line.y : Number.POSITIVE_INFINITY;
    const newBlock = gap > Math.max(spacing * 1.45, body * 1.9) || previous === undefined || previous.page !== line.page;
    const bullet = BULLET.exec(line.text);
    const numbered = bullet ? null : NUMBERED.exec(line.text);
    if (bullet || numbered) {
      const text = bullet ? `- ${line.text.slice(bullet[0].length)}` : `${line.text.slice(0, numbered![0].length - 1)} ${line.text.slice(numbered![0].length)}`;
      if (inList) out.push(paragraph);
      else endParagraph();
      paragraph = text;
      inList = true;
      return;
    }
    const indented = line.x > leftMargin + body * 1.5;
    if (inList && !newBlock && indented) {
      paragraph = join(paragraph, line.text);
      return;
    }
    if (newBlock || (inList && !indented)) endParagraph();
    paragraph = paragraph ? join(paragraph, line.text) : line.text;
  });
  endParagraph();

  // Consecutive list items stay in one list.
  let text = "";
  out.forEach((block, i) => {
    const kind = (b: string | undefined) => (b === undefined ? "" : b.startsWith("- ") ? "-" : /^\d{1,3}[.)] /.test(b) ? "1" : "");
    const same = kind(block) !== "" && kind(block) === kind(out[i - 1]);
    text += i === 0 ? block : `${same ? "\n" : "\n\n"}${block}`;
  });
  return text.trim();
}

import type { Diagnostic } from "@mdword/shared";

const OPEN = /^\s{0,3}(:{3,})\s*\{([^}\s]+)\}/;
const CLOSE = /^\s{0,3}(:{3,})\s*$/;
const CODE_FENCE = /^\s{0,3}(`{3,}|~{3,})/;

/**
 * MyST colon-fence directives that are opened and never closed, such as a
 * `:::{page-break}` without its closing `:::`. Text inside code fences is
 * ignored. One error per unclosed directive, naming it and where it starts.
 */
export function unclosedDirectives(source: string): Diagnostic[] {
  const stack: { colons: number; name: string; line: number }[] = [];
  let code: string | null = null;
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i]!;
    const fence = CODE_FENCE.exec(text)?.[1];
    if (code) {
      if (fence && fence[0] === code[0] && fence.length >= code.length && text.trim() === fence) code = null;
      continue;
    }
    if (fence) {
      code = fence;
      continue;
    }
    const open = OPEN.exec(text);
    if (open) {
      stack.push({ colons: open[1]!.length, name: open[2]!, line: i + 1 });
      continue;
    }
    const close = CLOSE.exec(text);
    if (close && stack.length > 0 && close[1]!.length >= stack[stack.length - 1]!.colons) stack.pop();
  }
  return stack.map((d) => ({
    severity: "error" as const,
    code: "directive-unclosed",
    line: d.line,
    message: `The directive {${d.name}} is never closed. Add a closing ::: line after it (a page break is :::{page-break} then :::).`
  }));
}

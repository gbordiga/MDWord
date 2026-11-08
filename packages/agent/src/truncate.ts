export const TOOL_OUTPUT_MAX_CHARS = 10_000;

export interface Truncated {
  text: string;
  truncated: boolean;
  elidedChars: number;
  /** Lines (relative to the input, 1-based) kept at the head and tail. */
  headEndLine: number;
  tailStartLine: number;
}

function countNewlines(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i += 1) if (s.charCodeAt(i) === 10) n += 1;
  return n;
}

/** Keep the first and last half of `max` characters and say how much was cut. */
export function truncateMiddle(text: string, max = TOOL_OUTPUT_MAX_CHARS): Truncated {
  const totalLines = countNewlines(text) + 1;
  if (text.length <= max) {
    return { text, truncated: false, elidedChars: 0, headEndLine: totalLines, tailStartLine: totalLines + 1 };
  }
  const half = Math.floor(max / 2);
  const head = text.slice(0, half);
  const tail = text.slice(text.length - half);
  const elidedChars = text.length - head.length - tail.length;
  const headEndLine = countNewlines(head) + 1;
  const tailStartLine = totalLines - countNewlines(tail);
  const marker =
    `\n[... ${elidedChars} characters elided (about lines ${headEndLine} to ${tailStartLine}). ` +
    `Call readFile with startLine and endLine to read that part. ...]\n`;
  return { text: head + marker + tail, truncated: true, elidedChars, headEndLine, tailStartLine };
}

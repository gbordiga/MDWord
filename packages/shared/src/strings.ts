/** Linear trims — trailing-repeat regexes are polynomial-ReDoS in CodeQL. */

export function stripTrailingChars(value: string, pred: (code: number) => boolean): string {
  let end = value.length;
  while (end > 0 && pred(value.charCodeAt(end - 1))) end -= 1;
  return value.slice(0, end);
}

export function stripEdgeChars(value: string, pred: (code: number) => boolean): string {
  let start = 0;
  let end = value.length;
  while (start < end && pred(value.charCodeAt(start))) start += 1;
  while (end > start && pred(value.charCodeAt(end - 1))) end -= 1;
  return value.slice(start, end);
}

export function stripTrailingWhitespace(value: string): string {
  return stripTrailingChars(value, (c) => c === 32 || c === 9 || c === 10 || c === 13 || c === 12);
}

/** Leading and trailing hyphens, e.g. after turning separators into `-`. */
export function stripEdgeDashes(value: string): string {
  return stripEdgeChars(value, (c) => c === 45);
}

export function stripTrailingSlashes(value: string): string {
  return stripTrailingChars(value, (c) => c === 47);
}

export function stripTrailingSeps(value: string): string {
  return stripTrailingChars(value, (c) => c === 47 || c === 92);
}

export function stripTrailingBackslashes(value: string): string {
  return stripTrailingChars(value, (c) => c === 92);
}

export function toPosixPath(value: string): string {
  return stripTrailingSlashes(value.replace(/\\/g, "/"));
}

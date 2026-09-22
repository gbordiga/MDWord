/** Linear trims — trailing-repeat regexes are polynomial-ReDoS in CodeQL. */

export function stripTrailingChars(value: string, pred: (code: number) => boolean): string {
  let end = value.length;
  while (end > 0 && pred(value.charCodeAt(end - 1))) end -= 1;
  return value.slice(0, end);
}

export function stripTrailingWhitespace(value: string): string {
  return stripTrailingChars(value, (c) => c === 32 || c === 9 || c === 10 || c === 13 || c === 12);
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

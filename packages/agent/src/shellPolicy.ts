import type { ShellName } from "@mdword/shared";

/**
 * The deterministic filter of ADR-011. It decides whether a command may skip
 * the approval card in the automatic modes. It never runs a command and no
 * model or setting can override it.
 *
 * It fails closed: only a command made entirely of known read-only programs
 * with plain arguments is `auto`. Anything it cannot parse, or does not know,
 * needs manual approval.
 */
export type PolicyResult = { auto: true } | { auto: false; reason: string };

const MAX_COMMAND_CHARS = 2000;

const manual = (reason: string): PolicyResult => ({ auto: false, reason });

interface Token {
  text: string;
  /** Any part of the token was quoted. */
  quoted: boolean;
}

type Segment = Token[];

/**
 * Split into simple commands. Returns a reason string when the text uses any
 * construct that is not a plain word list: redirection, substitution,
 * variables, subshells, blocks, background jobs, escapes, comments.
 */
function parse(command: string, shell: ShellName): Segment[] | string {
  const segments: Segment[] = [];
  let current: Segment = [];
  let word = "";
  let inWord = false;
  let quoted = false;
  const endWord = () => {
    if (inWord) current.push({ text: word, quoted });
    word = "";
    inWord = false;
    quoted = false;
  };
  const endSegment = () => {
    endWord();
    if (current.length > 0) segments.push(current);
    current = [];
  };
  const ps = shell === "powershell";

  for (let i = 0; i < command.length; i += 1) {
    const c = command[i]!;
    if (c === "'") {
      const end = command.indexOf("'", i + 1);
      if (end < 0) return "unterminated quote";
      word += command.slice(i + 1, end);
      inWord = true;
      quoted = true;
      i = end;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let text = "";
      for (; j < command.length && command[j] !== '"'; j += 1) {
        const d = command[j]!;
        if (d === "$" || d === "`") return "variable or substitution in a string";
        if (d === "\\" && !ps) return "escape in a string";
        text += d;
      }
      if (j >= command.length) return "unterminated quote";
      word += text;
      inWord = true;
      quoted = true;
      i = j;
      continue;
    }
    if (c === "\n" || c === ";") {
      endSegment();
      continue;
    }
    if (c === " " || c === "\t" || c === "\r") {
      endWord();
      continue;
    }
    if (c === "|") {
      if (command[i + 1] === "&") return "redirection";
      endSegment();
      if (command[i + 1] === "|") i += 1;
      continue;
    }
    if (c === "&") {
      if (command[i + 1] !== "&" || ps) return "background job or call operator";
      endSegment();
      i += 1;
      continue;
    }
    if (c === ">" || c === "<") return "redirection";
    if (c === "$" || c === "`") return "variable or substitution";
    if (c === "(" || c === ")") return "subshell or grouping";
    if (c === "{" || c === "}") return "block or brace expansion";
    if (c === "\\" && !ps) return "escape character";
    if (c === "[" && ps) return "type or member access";
    if (c === "@" && ps) return "splatting or array literal";
    if (c === "#" && !inWord) return "comment";
    if (c === "!" && !inWord) return "negation or history expansion";
    word += c;
    inWord = true;
  }
  endSegment();
  return segments;
}

const BASH_PROGRAMS = new Set(["ls", "cat", "head", "tail", "wc", "grep", "rg", "sort", "uniq", "echo", "pwd", "find"]);
const PS_PROGRAMS = new Set([
  "get-childitem",
  "gci",
  "ls",
  "dir",
  "get-content",
  "gc",
  "cat",
  "type",
  "select-string",
  "sls",
  "measure-object",
  "measure",
  "get-location",
  "pwd",
  "gl",
  "write-output",
  "echo",
  "sort-object",
  "sort",
  "select-object",
  "select",
  "rg"
]);
/** Programs both shells can start. Each has its own argument rule below. */
const EXTERNAL_PROGRAMS = new Set(["git", "node"]);

const GIT_READ = new Set(["status", "diff", "log", "show", "branch"]);
const GIT_BRANCH_FLAGS = new Set(["-a", "-r", "-v", "-vv", "--list", "--show-current", "--all", "--remotes"]);

const FIND_DENIED = /^-(delete|exec|execdir|ok|okdir|fprint|fprint0|fprintf|fls)$/;

/** Locations that hold secrets, in any spelling, anywhere in an argument. */
const CREDENTIAL =
  /(^|[\\/])(\.ssh|\.aws|\.gnupg|\.git-credentials|\.netrc|\.npmrc|\.pypirc|\.docker|\.kube|\.config|appdata|id_rsa|id_ed25519|cookies|login data)([\\/.]|$)|(^|[\\/])\.env(\.[\w.-]*)?$/i;

function checkPath(text: string, shell: ShellName): string | null {
  if (text === "") return null;
  if (/^[\\/~]/.test(text)) return "path outside the project";
  if (/^[a-z]:/i.test(text)) return "drive or provider path";
  if (text.split(/[\\/]/).includes("..")) return "parent folder";
  if (/%[^%\s]+%/.test(text)) return "environment variable";
  if (text.includes("\\\\")) return "network path";
  if (shell === "powershell" && /(^|[^\w])[a-z0-9_]{2,}:[\\/]|::/i.test(text)) return "provider path";
  if (CREDENTIAL.test(text)) return "credential location";
  return null;
}

function checkArgs(args: Token[], shell: ShellName): string | null {
  for (const arg of args) {
    const value = arg.text;
    const candidates = value.startsWith("-") && value.includes("=") ? [value.slice(value.indexOf("=") + 1)] : [value];
    if (value.startsWith("-") && !arg.quoted) {
      // An option with an attached value (`--file=/etc/passwd`, `-Path:C:\x`).
      const colon = value.match(/^-[A-Za-z]+:(.+)$/);
      if (colon) candidates.push(colon[1]!);
    } else if (value.startsWith("-")) {
      candidates.push(value.replace(/^-+/, ""));
    }
    for (const candidate of candidates) {
      const problem = checkPath(candidate, shell);
      if (problem) return problem;
    }
  }
  return null;
}

function checkProgram(name: string, args: Token[], shell: ShellName): string | null {
  const lower = name.toLowerCase();
  const texts = args.map((a) => a.text);
  if (EXTERNAL_PROGRAMS.has(lower)) {
    if (lower === "git") {
      const sub = texts[0];
      if (!sub || !GIT_READ.has(sub)) return "git command is not a read-only one";
      if (texts.some((a) => a.startsWith("--output") || a === "--ext-diff" || a === "--textconv" || a === "-o")) {
        return "git option that writes or runs a program";
      }
      if (sub === "branch" && texts.slice(1).some((a) => !GIT_BRANCH_FLAGS.has(a))) return "git branch changes branches";
      return null;
    }
    return texts.length === 1 && texts[0] === "--version" ? null : "node runs code";
  }
  const known = shell === "powershell" ? PS_PROGRAMS.has(lower) : BASH_PROGRAMS.has(name);
  if (!known) return "program is not on the read-only list";
  if (shell === "bash") {
    if (name === "find" && texts.some((a) => FIND_DENIED.test(a))) return "find option that changes files or runs programs";
    if (name === "sort" && texts.some((a) => a === "-o" || a.startsWith("--output") || /^-[a-zA-Z]*o/.test(a))) {
      return "sort writes a file";
    }
    if (name === "uniq" && texts.filter((a) => !a.startsWith("-")).length > 1) return "uniq writes a file";
    if (name === "rg" && texts.some((a) => a.startsWith("--pre"))) return "rg runs a program";
    if (name === "tail" && texts.some((a) => a === "-f" || a === "-F" || a.startsWith("--follow"))) return "tail waits forever";
  } else if (lower === "rg" && texts.some((a) => a.startsWith("--pre"))) {
    return "rg runs a program";
  }
  return null;
}

/**
 * Whether a command may run without a question in the automatic modes. This
 * says nothing about the user's own approval: manual mode always asks.
 */
export function checkCommand(command: string, shell: ShellName): PolicyResult {
  if (command.length === 0 || command.trim() === "") return manual("empty command");
  if (command.length > MAX_COMMAND_CHARS) return manual("command is long");
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(command)) return manual("control characters");
  const parsed = parse(command, shell);
  if (typeof parsed === "string") return manual(parsed);
  if (parsed.length === 0) return manual("no command found");
  for (const segment of parsed) {
    const [program, ...args] = segment;
    if (!program) return manual("no command found");
    if (program.text.includes("/") || program.text.includes("\\")) return manual("program given by path");
    if (program.text.includes("=")) return manual("variable assignment");
    const problem = checkProgram(program.text, args, shell) ?? checkArgs(args, shell);
    if (problem) return manual(problem);
  }
  return { auto: true };
}

import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  OutputTail,
  bashCandidates,
  diffSnapshots,
  isInside,
  powershellArgs,
  resolveFolder,
  scrubEnv,
  shellArgs
} from "./shellCore";

describe("scrubEnv", () => {
  it("passes only the allowlist and never a secret", () => {
    const env = scrubEnv({
      PATH: "/bin",
      HOME: "/home/a",
      LC_ALL: "C",
      OPENROUTER_API_KEY: "sk-or-v1-abc",
      GITHUB_TOKEN: "x",
      AWS_SECRET_ACCESS_KEY: "y",
      ELECTRON_RUN_AS_NODE: "1",
      MDWORD_ANYTHING: "z"
    });
    expect(env.PATH).toBe("/bin");
    expect(env.HOME).toBe("/home/a");
    expect(env.LC_ALL).toBe("C");
    expect(Object.keys(env).join(" ")).not.toMatch(/KEY|TOKEN|SECRET|ELECTRON|MDWORD/);
    expect(JSON.stringify(env)).not.toContain("sk-or");
    expect(env.GIT_TERMINAL_PROMPT).toBe("0");
  });
});

describe("resolveFolder", () => {
  const root = path.resolve("/work/project");
  it("accepts the root and folders inside it", () => {
    expect(resolveFolder(root, "")).toBe(root);
    expect(resolveFolder(root, "docs/a")).toBe(path.join(root, "docs", "a"));
  });
  it("refuses everything else", () => {
    for (const f of ["..", "../x", "a/../../x", "/etc", "\\x", "C:/x", "c:\\x", "a/..\\..\\x", "a\0b"]) {
      expect(resolveFolder(root, f), f).toBeNull();
    }
  });
  it("isInside compares resolved paths", () => {
    expect(isInside(root, path.join(root, "a"))).toBe(true);
    expect(isInside(root, root)).toBe(true);
    expect(isInside(root, path.resolve("/work/project2"))).toBe(false);
    expect(isInside(root, path.resolve("/work"))).toBe(false);
  });
});

describe("shell resolution", () => {
  it("skips the WSL launcher in System32 on Windows", () => {
    const list = bashCandidates(
      "win32",
      { ProgramFiles: "C:\\Program Files", SystemRoot: "C:\\Windows" },
      ["C:\\Windows\\System32\\bash.exe", "D:\\tools\\bash.exe"]
    );
    expect(list).not.toContain("C:\\Windows\\System32\\bash.exe");
    expect(list[0]).toBe("C:\\Program Files\\Git\\bin\\bash.exe");
    expect(list).toContain("D:\\tools\\bash.exe");
  });
  it("uses /bin/bash first elsewhere", () => {
    expect(bashCandidates("linux", {}, ["/opt/bash"])[0]).toBe("/bin/bash");
  });
  it("passes bash the command after -c and PowerShell an encoded script", () => {
    expect(shellArgs("bash", "ls -la")).toEqual(["-c", "ls -la"]);
    const args = powershellArgs("Get-ChildItem 'a b'");
    expect(args.slice(0, 3)).toEqual(["-NoProfile", "-NonInteractive", "-NoLogo"]);
    const script = Buffer.from(args[4]!, "base64").toString("utf16le");
    expect(script.endsWith("Get-ChildItem 'a b'")).toBe(true);
  });
});

describe("OutputTail", () => {
  it("keeps everything when small", () => {
    const t = new OutputTail(100);
    t.push("hello ");
    t.push("world");
    expect(t.value()).toBe("hello world");
    expect(t.truncated).toBe(false);
  });
  it("keeps the end and says so when large", () => {
    const t = new OutputTail(50);
    for (let i = 0; i < 100; i += 1) t.push(`line ${i}\n`);
    const v = t.value();
    expect(t.truncated).toBe(true);
    expect(v).toContain("line 99");
    expect(v).not.toContain("line 0\n");
    expect(v.startsWith("[output cut")).toBe(true);
  });
});

describe("diffSnapshots", () => {
  it("lists added, changed and removed files, sorted", () => {
    const before = new Map([["a.md", "1:1"], ["b.md", "1:1"], ["c.md", "1:1"]]);
    const after = new Map([["a.md", "1:1"], ["b.md", "2:1"], ["d.md", "1:1"]]);
    expect(diffSnapshots(before, after)).toEqual(["b.md", "c.md", "d.md"]);
  });
});

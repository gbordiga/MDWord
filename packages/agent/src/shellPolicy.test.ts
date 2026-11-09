import { describe, expect, it } from "vitest";
import { checkCommand } from "./shellPolicy";

const auto = (command: string, shell: "bash" | "powershell" = "bash") => checkCommand(command, shell).auto;
const reason = (command: string, shell: "bash" | "powershell" = "bash") => {
  const r = checkCommand(command, shell);
  return r.auto ? "" : r.reason;
};

describe("checkCommand: what may skip the approval card", () => {
  it("accepts plain read-only bash", () => {
    for (const c of [
      "ls -la docs",
      "cat notes/a.md",
      "grep -rn TODO docs",
      "wc -l a.md b.md",
      "head -n 20 a.md | grep foo | sort | uniq",
      "echo 'a;b' && pwd",
      "find . -name '*.md'",
      "git status",
      "git diff HEAD~1",
      "git log --oneline -n 5",
      "git branch --list",
      "pnpm test",
      "node --version"
    ]) {
      expect(auto(c), c).toBe(true);
    }
  });

  it("accepts plain read-only PowerShell, case-insensitive", () => {
    for (const c of [
      "Get-ChildItem -Recurse -Filter *.md",
      "get-content notes\\a.md | Select-String foo",
      "Get-Content a.md | Measure-Object -Line",
      "git status"
    ]) {
      expect(auto(c, "powershell"), c).toBe(true);
    }
  });

  it("sends the network, deletes and writes to manual approval", () => {
    for (const c of [
      "curl https://example.com",
      "rm a.md",
      "mv a.md b.md",
      "cp a.md b.md",
      "echo hi > a.md",
      "echo hi >> a.md",
      "cat a.md | tee b.md",
      "sed -i s/a/b/ a.md",
      "git push",
      "git fetch",
      "git branch -D x",
      "git diff --output=out.txt",
      "pnpm install",
      "pnpm test --filter x",
      "node -e 'process.exit()'",
      "node script.js"
    ]) {
      expect(auto(c), c).toBe(false);
    }
    for (const c of ["Remove-Item a.md", "Set-Content a.md x", "Invoke-WebRequest http://x", "Out-File a.txt"]) {
      expect(auto(c, "powershell"), c).toBe(false);
    }
  });

  it("refuses find and sort options that write or run programs", () => {
    expect(auto("find . -delete")).toBe(false);
    expect(auto("find . -exec rm {} +")).toBe(false);
    expect(auto("find . -fprint out.txt")).toBe(false);
    expect(auto("sort -o out.txt a.txt")).toBe(false);
    expect(auto("sort --output=out.txt a.txt")).toBe(false);
    expect(auto("uniq in.txt out.txt")).toBe(false);
    expect(auto("rg --pre ./x foo")).toBe(false);
  });

  it("refuses paths outside the project", () => {
    for (const c of ["cat /etc/passwd", "cat ../x.md", "ls ~", "cat ~/x", "ls C:/Users", "cat ..\\x", "ls //server/share"]) {
      expect(auto(c), c).toBe(false);
    }
    expect(auto("Get-Content C:\\Users\\a\\x.txt", "powershell")).toBe(false);
    expect(auto("Get-ChildItem HKLM:\\Software", "powershell")).toBe(false);
    expect(auto("Get-Content --path=/etc/passwd")).toBe(false);
    expect(auto("Get-Content -Path:C:\\x", "powershell")).toBe(false);
    expect(auto("cat %USERPROFILE%\\x")).toBe(false);
  });

  it("refuses credential locations inside the project", () => {
    for (const c of ["cat .env", "cat app/.env.local", "cat .ssh/id_rsa", "ls .aws", "cat .git-credentials", "cat .npmrc"]) {
      expect(auto(c), c).toBe(false);
    }
    expect(auto("cat environment.md")).toBe(true);
  });

  it("refuses substitution, variables, subshells, blocks, jobs and escapes", () => {
    for (const c of [
      "echo $(whoami)",
      "echo `whoami`",
      "echo $HOME",
      'echo "$HOME"',
      "(ls)",
      "ls &",
      "ls & ls",
      "{ ls; }",
      "echo {a,b}",
      "cat a\\ b",
      "ls # hide",
      "ls 2>&1",
      "cat <<EOF",
      "cat < a.md",
      "FOO=1 ls"
    ]) {
      expect(auto(c), c).toBe(false);
    }
  });

  it("refuses PowerShell expressions and .NET calls", () => {
    for (const c of [
      "[System.IO.File]::Delete('a')",
      "$x = 1",
      "Get-Content a | ForEach-Object { $_ }",
      "iex 'ls'",
      "Invoke-Expression 'ls'",
      "& ls",
      "Get-Content `a",
      '"a" | Out-String',
      "@(1,2)",
      "Get-Content a.md; [IO.File]::Delete('b')"
    ]) {
      expect(auto(c, "powershell"), c).toBe(false);
    }
  });

  it("refuses shells, interpreters and encoded payloads", () => {
    for (const c of ["bash -c ls", "sh -c ls", "python -c 'print(1)'", "eval ls", "source x.sh", "base64 -d x"]) {
      expect(auto(c), c).toBe(false);
    }
    for (const c of ["pwsh -Command ls", "powershell -EncodedCommand AAAA", "cmd /c dir"]) {
      expect(auto(c, "powershell"), c).toBe(false);
    }
  });

  it("checks every part of a compound command", () => {
    expect(auto("ls && rm a.md")).toBe(false);
    expect(auto("ls; curl x")).toBe(false);
    expect(auto("cat a.md | sh")).toBe(false);
    expect(auto("ls\nrm a.md")).toBe(false);
    expect(auto("ls || rm a.md")).toBe(false);
  });

  it("fails closed when it cannot parse or finds nothing", () => {
    expect(reason("")).toBe("empty command");
    expect(reason("   ")).toBe("empty command");
    expect(reason(";")).toBe("no command found");
    expect(auto("echo 'open")).toBe(false);
    expect(auto('echo "open')).toBe(false);
    expect(auto("echo \u0000")).toBe(false);
    expect(auto(`echo ${"a".repeat(3000)}`)).toBe(false);
    expect(auto("./script.sh")).toBe(false);
    expect(auto("/bin/ls")).toBe(false);
  });
});

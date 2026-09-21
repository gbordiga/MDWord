import { describe, expect, it } from "vitest";
import {
  isAssociatedProgId,
  markdownApplicationIcon,
  markdownDocumentIcon,
  markdownOpenCommand,
  markdownOpenWithCommand,
  markdownSamplePath,
  MARKDOWN_ASSOCIATION_PROG_ID,
  parseRegSz
} from "./fileAssociation";

describe("markdown file association helpers", () => {
  it("parses a default REG_SZ value", () => {
    const stdout = `HKEY_CURRENT_USER\\Software\\Classes\\.md
    (Default)    REG_SZ    MDWord.Markdown
`;
    expect(parseRegSz(stdout)).toBe(MARKDOWN_ASSOCIATION_PROG_ID);
  });

  it("parses UserChoice ProgId values", () => {
    const stdout = `HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.md\\UserChoice
    ProgId    REG_SZ    MDWord.Markdown
`;
    expect(parseRegSz(stdout, "ProgId")).toBe(MARKDOWN_ASSOCIATION_PROG_ID);
  });

  it("treats only the MDWord ProgId as associated", () => {
    expect(isAssociatedProgId("MDWord.Markdown")).toBe(true);
    expect(isAssociatedProgId("mdword.markdown")).toBe(true);
    expect(isAssociatedProgId("Applications\\Code.exe")).toBe(false);
    expect(isAssociatedProgId(null)).toBe(false);
  });

  it("quotes the open command so paths with spaces work", () => {
    expect(markdownOpenCommand("C:\\Program Files\\MDWord\\MDWord.exe")).toBe(
      '"C:\\Program Files\\MDWord\\MDWord.exe" "%1"'
    );
  });

  it("opens the Windows Open with dialog for a .md file", () => {
    expect(markdownSamplePath("md", "C:\\Temp")).toBe("C:\\Temp\\MDWord.md");
    expect(markdownSamplePath("markdown", "C:\\Temp")).toBe("C:\\Temp\\MDWord.markdown");
    const launched = markdownOpenWithCommand("C:\\Temp\\MDWord.md");
    expect(launched.command).toBe("rundll32.exe");
    expect(launched.args).toEqual(["shell32.dll,OpenAs_RunDLL", "C:\\Temp\\MDWord.md"]);
  });

  it("uses a distinct document icon when a file icon is available", () => {
    const exe = "C:\\Program Files\\MDWord\\MDWord.exe";
    const fileIcon = "C:\\Program Files\\MDWord\\resources\\file-icon.ico";
    expect(markdownApplicationIcon(exe)).toBe(`${exe},0`);
    expect(markdownDocumentIcon(exe, fileIcon)).toBe(fileIcon);
    expect(markdownDocumentIcon(exe)).toBe(`${exe},0`);
  });
});

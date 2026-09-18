import { describe, expect, it } from "vitest";
import {
  defaultAppSettingsUrl,
  isAssociatedProgId,
  markdownOpenCommand,
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

  it("opens the per-user default-apps page for MDWord", () => {
    expect(defaultAppSettingsUrl()).toBe("ms-settings:defaultapps?registeredAppUser=MDWord");
  });
});

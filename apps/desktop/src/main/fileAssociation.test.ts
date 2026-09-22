import { describe, expect, it } from "vitest";
import {
  bundleIsDefault,
  defaultAppsSettingsPlan,
  desktopFileIsDefault,
  isAssociatedProgId,
  linuxDesktopEntry,
  linuxMimePackageXml,
  linuxSettingsCommands,
  macAppBundlePath,
  markdownApplicationIcon,
  markdownDocumentIcon,
  markdownOpenCommand,
  MARKDOWN_ASSOCIATION_PROG_ID,
  parseRegSz,
  quoteDesktopExec
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

  it("uses a distinct document icon when a file icon is available", () => {
    const exe = "C:\\Program Files\\MDWord\\MDWord.exe";
    const fileIcon = "C:\\Program Files\\MDWord\\resources\\file-icon.ico";
    expect(markdownApplicationIcon(exe)).toBe(`${exe},0`);
    expect(markdownDocumentIcon(exe, fileIcon)).toBe(fileIcon);
    expect(markdownDocumentIcon(exe)).toBe(`${exe},0`);
  });

  it("opens Windows Settings for the registered app instead of a temporary file", () => {
    const plan = defaultAppsSettingsPlan("win32");
    expect(plan).toEqual({
      kind: "url",
      url: "ms-settings:defaultapps?registeredAppUser=MDWord",
      fallbackUrl: "ms-settings:defaultapps"
    });
  });

  it("opens System Settings on macOS", () => {
    const plan = defaultAppsSettingsPlan("darwin");
    expect(plan?.kind).toBe("commands");
    if (plan?.kind !== "commands") return;
    expect(plan.commands[0]).toEqual({
      command: "open",
      args: ["x-apple.systempreferences:com.apple.settings.Apps.DefaultApps"]
    });
    expect(plan.commands.map((step) => step.command)).toContain("open");
  });

  it("picks the desktop environment file-type settings on Linux", () => {
    expect(linuxSettingsCommands({ XDG_CURRENT_DESKTOP: "KDE" })[0]?.command).toBe("kcmshell6");
    expect(linuxSettingsCommands({ XDG_CURRENT_DESKTOP: "XFCE" })[0]?.command).toBe("xfce4-mime-settings");
    expect(linuxSettingsCommands({ XDG_CURRENT_DESKTOP: "GNOME" })[0]?.args).toEqual(["default-apps"]);
    const plan = defaultAppsSettingsPlan("linux", { XDG_CURRENT_DESKTOP: "ubuntu:GNOME" });
    expect(plan?.kind).toBe("commands");
  });

  it("recognizes the Freedesktop and macOS handlers", () => {
    expect(desktopFileIsDefault("mdword.desktop\n")).toBe(true);
    expect(desktopFileIsDefault("code.desktop")).toBe(false);
    expect(bundleIsDefault("app.mdword.desktop")).toBe(true);
    expect(bundleIsDefault("com.microsoft.VSCode")).toBe(false);
  });

  it("writes a desktop entry without creating a markdown document", () => {
    const entry = linuxDesktopEntry("/opt/MDWord/mdword", "/opt/MDWord/icon.png");
    expect(entry).toContain("Exec=/opt/MDWord/mdword %f");
    expect(entry).toContain("MimeType=text/markdown;text/x-markdown;");
    expect(entry).toContain("Icon=/opt/MDWord/icon.png");
    expect(entry).not.toContain(".md");
    expect(quoteDesktopExec("/opt/MD Word/mdword")).toBe('"/opt/MD Word/mdword"');
    expect(linuxMimePackageXml()).toContain('pattern="*.markdown"');
  });

  it("only treats a real .app bundle as the macOS application", () => {
    expect(macAppBundlePath("/Applications/MDWord.app/Contents/MacOS/MDWord")).toBe("/Applications/MDWord.app");
    expect(macAppBundlePath("/usr/bin/electron")).toBeNull();
  });
});

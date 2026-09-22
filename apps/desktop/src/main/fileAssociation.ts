import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const MARKDOWN_ASSOCIATION_PROG_ID = "MDWord.Markdown";
export const MARKDOWN_ASSOCIATION_EXTS = ["md", "markdown", "mdown", "mkd"] as const;
export const MARKDOWN_ASSOCIATION_APP_NAME = "MDWord";
export const LINUX_DESKTOP_FILE = "mdword.desktop";
export const MAC_BUNDLE_ID = "app.mdword.desktop";

export type MarkdownAssociationPlatform = "win32" | "darwin" | "linux" | "other";

export type MarkdownAssociationStatus = {
  supported: boolean;
  isDefault: boolean;
  missing: string[];
  platform: MarkdownAssociationPlatform;
};

export type SettingsCommand = { command: string; args: string[] };

export type SettingsPlan =
  | { kind: "url"; url: string; fallbackUrl: string }
  | { kind: "commands"; commands: SettingsCommand[] };

const unsupported = (platform: MarkdownAssociationPlatform): MarkdownAssociationStatus => ({
  supported: false,
  isDefault: false,
  missing: [],
  platform
});

export function associationPlatform(platform: NodeJS.Platform = process.platform): MarkdownAssociationPlatform {
  if (platform === "win32" || platform === "darwin" || platform === "linux") return platform;
  return "other";
}

export function parseRegSz(stdout: string | null | undefined, valueName = "(Default)"): string | null {
  if (!stdout) return null;
  const escaped = valueName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = stdout.match(new RegExp(`${escaped}\\s+REG_\\w+\\s+(.*)$`, "im"));
  const value = match?.[1]?.trim();
  return value || null;
}

export function isAssociatedProgId(value: string | null | undefined): boolean {
  return String(value ?? "").trim().toLowerCase() === MARKDOWN_ASSOCIATION_PROG_ID.toLowerCase();
}

export function markdownOpenCommand(exePath: string): string {
  return `"${exePath}" "%1"`;
}

export function markdownApplicationIcon(exePath: string): string {
  return `${exePath},0`;
}

export function markdownDocumentIcon(exePath: string, fileIconPath?: string): string {
  return fileIconPath || markdownApplicationIcon(exePath);
}

export function defaultAppsSettingsPlan(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env
): SettingsPlan | null {
  if (platform === "win32") {
    return {
      kind: "url",
      url: `ms-settings:defaultapps?registeredAppUser=${encodeURIComponent(MARKDOWN_ASSOCIATION_APP_NAME)}`,
      fallbackUrl: "ms-settings:defaultapps"
    };
  }
  if (platform === "darwin") {
    return {
      kind: "commands",
      commands: [
        { command: "open", args: ["x-apple.systempreferences:com.apple.settings.Apps.DefaultApps"] },
        { command: "open", args: ["-a", "System Settings"] },
        { command: "open", args: ["-a", "System Preferences"] }
      ]
    };
  }
  if (platform === "linux") {
    return { kind: "commands", commands: linuxSettingsCommands(env) };
  }
  return null;
}

export function linuxSettingsCommands(env: NodeJS.ProcessEnv): SettingsCommand[] {
  const desktop = `${env.XDG_CURRENT_DESKTOP ?? ""} ${env.DESKTOP_SESSION ?? ""}`.toLowerCase();
  const kde: SettingsCommand[] = [
    { command: "kcmshell6", args: ["kcm_filetypes"] },
    { command: "kcmshell5", args: ["filetypes"] }
  ];
  const gnome: SettingsCommand[] = [
    { command: "gnome-control-center", args: ["default-apps"] },
    { command: "gnome-control-center", args: ["applications"] }
  ];
  const xfce: SettingsCommand[] = [{ command: "xfce4-mime-settings", args: [] }];
  const cinnamon: SettingsCommand[] = [{ command: "cinnamon-settings", args: ["default"] }];
  const mate: SettingsCommand[] = [{ command: "mate-default-applications-properties", args: [] }];
  if (desktop.includes("kde") || desktop.includes("plasma")) return [...kde, ...gnome, ...xfce];
  if (desktop.includes("xfce")) return [...xfce, ...gnome, ...kde];
  if (desktop.includes("cinnamon")) return [...cinnamon, ...gnome];
  if (desktop.includes("mate")) return [...mate, ...gnome];
  if (desktop.includes("gnome") || desktop.includes("unity")) return [...gnome, ...kde, ...xfce];
  return [...gnome, ...kde, ...xfce, ...cinnamon];
}

export function quoteDesktopExec(exePath: string): string {
  if (!/[\s"\\]/.test(exePath)) return exePath;
  return `"${exePath.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function linuxDesktopEntry(exePath: string, iconPath?: string): string {
  const lines = [
    "[Desktop Entry]",
    "Type=Application",
    "Name=MDWord",
    "Comment=Write like Word. Save as Markdown.",
    `Exec=${quoteDesktopExec(exePath)} %f`,
    "MimeType=text/markdown;text/x-markdown;",
    "Categories=Office;TextEditor;",
    "StartupWMClass=MDWord",
    "Terminal=false"
  ];
  if (iconPath) lines.push(`Icon=${iconPath}`);
  return `${lines.join("\n")}\n`;
}

export function linuxMimePackageXml(): string {
  const globs = MARKDOWN_ASSOCIATION_EXTS.map((ext) => `    <glob pattern="*.${ext}"/>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">
  <mime-type type="text/markdown">
${globs}
  </mime-type>
</mime-info>
`;
}

export function desktopFileIsDefault(queryStdout: string | null | undefined, desktopFile = LINUX_DESKTOP_FILE): boolean {
  const name = queryStdout?.trim().split(/\s+/)[0]?.toLowerCase();
  return name === desktopFile.toLowerCase();
}

export function bundleIsDefault(handler: string | null | undefined, bundleId = MAC_BUNDLE_ID): boolean {
  return String(handler ?? "").trim().toLowerCase() === bundleId.toLowerCase();
}

/** Packaged macOS builds live inside `MDWord.app`. Dev Electron binaries do not. */
export function macAppBundlePath(exePath: string): string | null {
  const marker = ".app/Contents/MacOS/";
  const index = exePath.replace(/\\/g, "/").lastIndexOf(marker);
  if (index < 0) return null;
  return exePath.slice(0, index + ".app".length);
}

function linuxDataHome(env: NodeJS.ProcessEnv = process.env, home = os.homedir()): string {
  return env.XDG_DATA_HOME || path.join(home, ".local", "share");
}

async function extensionIsDefault(ext: string): Promise<boolean> {
  const choice = await readUserChoice(ext);
  if (choice) return isAssociatedProgId(choice);
  return isAssociatedProgId(await readClassDefault(ext));
}

async function regQuery(key: string, valueName?: string): Promise<string | null> {
  const args = valueName ? ["query", key, "/v", valueName] : ["query", key, "/ve"];
  try {
    const { stdout } = await execFileAsync("reg", args, { windowsHide: true });
    return stdout;
  } catch {
    return null;
  }
}

async function regAdd(key: string, valueName: string | null, type: "REG_SZ" | "REG_NONE", data = ""): Promise<void> {
  const args = ["add", key, "/f", "/t", type];
  if (valueName == null) args.push("/ve");
  else args.push("/v", valueName);
  if (type === "REG_SZ") args.push("/d", data);
  await execFileAsync("reg", args, { windowsHide: true });
}

async function readUserChoice(ext: string): Promise<string | null> {
  const stdout = await regQuery(
    `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.${ext}\\UserChoice`,
    "ProgId"
  );
  return parseRegSz(stdout, "ProgId");
}

async function readClassDefault(ext: string): Promise<string | null> {
  const stdout = await regQuery(`HKCU\\Software\\Classes\\.${ext}`);
  return parseRegSz(stdout);
}

async function windowsStatus(): Promise<MarkdownAssociationStatus> {
  const missing: string[] = [];
  for (const ext of MARKDOWN_ASSOCIATION_EXTS) {
    if (!(await extensionIsDefault(ext))) missing.push(ext);
  }
  return { supported: true, isDefault: !missing.includes("md"), missing, platform: "win32" };
}

async function queryLinuxDefault(mime: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("xdg-mime", ["query", "default", mime], { windowsHide: true });
    return stdout;
  } catch {
    return null;
  }
}

async function linuxStatus(): Promise<MarkdownAssociationStatus> {
  const markdown = await queryLinuxDefault("text/markdown");
  const legacy = await queryLinuxDefault("text/x-markdown");
  const isDefault = desktopFileIsDefault(markdown) || desktopFileIsDefault(legacy);
  return {
    supported: true,
    isDefault,
    missing: isDefault ? [] : ["md"],
    platform: "linux"
  };
}

const MAC_HANDLER_SCRIPT = `
ObjC.import("CoreServices");
function handler(ext) {
  try {
    var uti = $.UTTypeCreatePreferredIdentifierForTag($.kUTTagClassFilenameExtension, $(ext), null);
    if (!uti) return "";
    var bundle = $.LSCopyDefaultRoleHandlerForContentType(uti, $.kLSRolesAll);
    if (!bundle) return "";
    return String(ObjC.unwrap(bundle));
  } catch (error) {
    return "";
  }
}
JSON.stringify(["md", "markdown", "mdown", "mkd"].map(handler));
`;

async function macStatus(): Promise<MarkdownAssociationStatus> {
  try {
    const { stdout } = await execFileAsync("osascript", ["-l", "JavaScript", "-e", MAC_HANDLER_SCRIPT], {
      timeout: 8000
    });
    const handlers = JSON.parse(stdout.trim()) as unknown;
    const md = Array.isArray(handlers) ? String(handlers[0] ?? "") : "";
    const isDefault = bundleIsDefault(md);
    return { supported: true, isDefault, missing: isDefault ? [] : ["md"], platform: "darwin" };
  } catch {
    return { supported: true, isDefault: false, missing: ["md"], platform: "darwin" };
  }
}

export async function getMarkdownAssociationStatus(platform = process.platform): Promise<MarkdownAssociationStatus> {
  if (platform === "win32") return windowsStatus();
  if (platform === "darwin") return macStatus();
  if (platform === "linux") return linuxStatus();
  return unsupported(associationPlatform(platform));
}

async function installLinuxAssociation(exePath: string, fileIconPath?: string): Promise<void> {
  const dataHome = linuxDataHome();
  const applications = path.join(dataHome, "applications");
  const mimePackages = path.join(dataHome, "mime", "packages");
  await fs.mkdir(applications, { recursive: true });
  await fs.mkdir(mimePackages, { recursive: true });
  await fs.writeFile(path.join(applications, LINUX_DESKTOP_FILE), linuxDesktopEntry(exePath, fileIconPath), "utf8");
  await fs.writeFile(path.join(mimePackages, "mdword.xml"), linuxMimePackageXml(), "utf8");
  await execFileAsync("update-desktop-database", [applications], { windowsHide: true }).catch(() => undefined);
  await execFileAsync("update-mime-database", [path.join(dataHome, "mime")], { windowsHide: true }).catch(() => undefined);
}

async function setLinuxMarkdownDefault(): Promise<void> {
  for (const mime of ["text/markdown", "text/x-markdown"]) {
    await execFileAsync("xdg-mime", ["default", LINUX_DESKTOP_FILE, mime], { windowsHide: true }).catch(() => undefined);
  }
}

const MAC_SET_SCRIPT = `
ObjC.import("CoreServices");
function claim(ext) {
  try {
    var uti = $.UTTypeCreatePreferredIdentifierForTag($.kUTTagClassFilenameExtension, $(ext), null);
    if (!uti) return 1;
    return $.LSSetDefaultRoleHandlerForContentType(uti, $.kLSRolesAll, $("${MAC_BUNDLE_ID}"));
  } catch (error) {
    return 1;
  }
}
JSON.stringify(["md", "markdown", "mdown", "mkd"].map(claim));
`;

async function setMacMarkdownDefault(): Promise<void> {
  await execFileAsync("osascript", ["-l", "JavaScript", "-e", MAC_SET_SCRIPT], { timeout: 8000 }).catch(() => undefined);
}

function spawnDetached(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      child.removeAllListeners();
      if (ok) child.unref();
      resolve(ok);
    };
    child.once("error", () => done(false));
    child.once("spawn", () => done(true));
  });
}

export async function openDefaultAppsSettings(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env
): Promise<boolean> {
  const plan = defaultAppsSettingsPlan(platform, env);
  if (!plan) return false;
  if (plan.kind === "url") {
    try {
      const { shell } = await import("electron");
      await shell.openExternal(plan.url);
      return true;
    } catch {
      try {
        const { shell } = await import("electron");
        await shell.openExternal(plan.fallbackUrl);
        return true;
      } catch {
        return false;
      }
    }
  }
  for (const step of plan.commands) {
    if (await spawnDetached(step.command, step.args)) return true;
  }
  return false;
}

export async function writeMarkdownAssociation(
  exePath: string,
  platform = process.platform,
  fileIconPath?: string
): Promise<MarkdownAssociationStatus> {
  if (platform === "linux") {
    await installLinuxAssociation(exePath, fileIconPath);
    return getMarkdownAssociationStatus(platform);
  }
  if (platform !== "win32") return getMarkdownAssociationStatus(platform);
  const command = markdownOpenCommand(exePath);
  const appIcon = markdownApplicationIcon(exePath);
  const fileIcon = markdownDocumentIcon(exePath, fileIconPath);
  await regAdd(`HKCU\\Software\\Classes\\${MARKDOWN_ASSOCIATION_PROG_ID}`, null, "REG_SZ", "Markdown document");
  await regAdd(`HKCU\\Software\\Classes\\${MARKDOWN_ASSOCIATION_PROG_ID}\\DefaultIcon`, null, "REG_SZ", fileIcon);
  await regAdd(`HKCU\\Software\\Classes\\${MARKDOWN_ASSOCIATION_PROG_ID}\\shell\\open`, null, "REG_SZ", "Open with MDWord");
  await regAdd(`HKCU\\Software\\Classes\\${MARKDOWN_ASSOCIATION_PROG_ID}\\shell\\open\\command`, null, "REG_SZ", command);
  await regAdd("HKCU\\Software\\MDWord\\Capabilities", "ApplicationName", "REG_SZ", MARKDOWN_ASSOCIATION_APP_NAME);
  await regAdd(
    "HKCU\\Software\\MDWord\\Capabilities",
    "ApplicationDescription",
    "REG_SZ",
    "Write like Word. Save as Markdown."
  );
  await regAdd("HKCU\\Software\\MDWord\\Capabilities", "ApplicationIcon", "REG_SZ", appIcon);
  await regAdd("HKCU\\Software\\RegisteredApplications", MARKDOWN_ASSOCIATION_APP_NAME, "REG_SZ", "Software\\MDWord\\Capabilities");
  for (const ext of MARKDOWN_ASSOCIATION_EXTS) {
    await regAdd(`HKCU\\Software\\Classes\\.${ext}`, null, "REG_SZ", MARKDOWN_ASSOCIATION_PROG_ID);
    await regAdd(`HKCU\\Software\\Classes\\.${ext}\\OpenWithProgids`, MARKDOWN_ASSOCIATION_PROG_ID, "REG_NONE");
    await regAdd(
      "HKCU\\Software\\MDWord\\Capabilities\\FileAssociations",
      `.${ext}`,
      "REG_SZ",
      MARKDOWN_ASSOCIATION_PROG_ID
    );
  }
  return getMarkdownAssociationStatus(platform);
}

export async function registerMarkdownAssociation(
  exePath: string,
  platform = process.platform,
  fileIconPath?: string
): Promise<MarkdownAssociationStatus> {
  const status = await writeMarkdownAssociation(exePath, platform, fileIconPath);
  if (!status.supported || status.isDefault) return status;
  if (platform === "linux") await setLinuxMarkdownDefault();
  if (platform === "darwin" && macAppBundlePath(exePath)) await setMacMarkdownDefault();
  await openDefaultAppsSettings(platform);
  return getMarkdownAssociationStatus(platform);
}

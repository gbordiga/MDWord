import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const MARKDOWN_ASSOCIATION_PROG_ID = "MDWord.Markdown";
export const MARKDOWN_ASSOCIATION_EXTS = ["md", "markdown", "mdown", "mkd"] as const;
export const MARKDOWN_ASSOCIATION_APP_NAME = "MDWord";

export type MarkdownAssociationStatus = {
  supported: boolean;
  isDefault: boolean;
  missing: string[];
};

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

export function markdownSamplePath(ext: string, tmpDir = os.tmpdir()): string {
  return path.join(tmpDir, `MDWord.${ext}`);
}

export function markdownOpenWithCommand(samplePath: string): { command: string; args: string[] } {
  return { command: "rundll32.exe", args: ["shell32.dll,OpenAs_RunDLL", samplePath] };
}

export async function launchMarkdownOpenWithDialog(ext: string): Promise<void> {
  const samplePath = markdownSamplePath(ext);
  await fs.writeFile(samplePath, "", "utf8");
  const { command, args } = markdownOpenWithCommand(samplePath);
  await execFileAsync(command, args, { windowsHide: false }).catch(() => undefined);
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

export async function getMarkdownAssociationStatus(platform = process.platform): Promise<MarkdownAssociationStatus> {
  if (platform !== "win32") return { supported: false, isDefault: false, missing: [] };
  const missing: string[] = [];
  for (const ext of MARKDOWN_ASSOCIATION_EXTS) {
    if (!(await extensionIsDefault(ext))) missing.push(ext);
  }
  return { supported: true, isDefault: !missing.includes("md"), missing };
}

export async function writeMarkdownAssociation(
  exePath: string,
  platform = process.platform,
  fileIconPath?: string
): Promise<MarkdownAssociationStatus> {
  if (platform !== "win32") return { supported: false, isDefault: false, missing: [] };
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
  if (platform === "win32" && status.missing.includes("md")) {
    await launchMarkdownOpenWithDialog("md");
  }
  return getMarkdownAssociationStatus(platform);
}

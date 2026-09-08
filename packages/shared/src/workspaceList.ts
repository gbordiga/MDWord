/** Directories that explode listing size and are never useful in a document workspace. */
export const SKIP_WORKSPACE_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  ".turbo",
  "__pycache__",
  ".venv",
  "venv"
]);

export const SKIP_WORKSPACE_FILE_NAMES = new Set([".DS_Store", "Thumbs.db"]);

export const MAX_WORKSPACE_LIST_DEPTH = 12;
export const MAX_WORKSPACE_LIST_ENTRIES = 8000;

export function shouldSkipWorkspaceDir(name: string): boolean {
  return SKIP_WORKSPACE_DIR_NAMES.has(name);
}

export function shouldSkipWorkspaceFile(name: string): boolean {
  return SKIP_WORKSPACE_FILE_NAMES.has(name);
}

export function isMarkdownFileName(name: string): boolean {
  return /\.(md|markdown)$/i.test(name);
}

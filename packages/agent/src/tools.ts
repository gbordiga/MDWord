import { unclosedDirectives } from "./directives";
import { tool } from "ai";
import { z } from "zod";
import { applyEdits } from "./edits";
import { normalizeWorkspacePath } from "./paths";
import { TOOL_DESCRIPTIONS } from "./prompt";
import { READ_CHUNK_CHARS, READ_CHUNK_LINES } from "./truncate";
import type { AssistantEnv, StopReason } from "./types";

export interface ToolContext {
  env: AssistantEnv;
  signal?: AbortSignal;
  maxToolChars: number;
  toolChars: number;
  /** Set when a tool decides the turn must end after the current step. */
  stopReason: StopReason | null;
}

export type ToolFailure = { ok: false; error: string };

const MAX_LIST = 200;
const MAX_NEW_FILE_CHARS = 500_000;

/** Names Windows, macOS, and Linux all accept. Keep in step with `isValidWorkspaceEntryName`. */
function isPortableName(name: string): boolean {
  return name.trim() !== "" && name.length <= 200 && !/[:*?"<>|]/.test(name);
}
let proposalCounter = 0;

function fail(error: string): ToolFailure {
  return { ok: false, error };
}

function newProposalId(): string {
  proposalCounter += 1;
  return `${Date.now().toString(36)}${proposalCounter.toString(36)}`;
}

function account<T extends object>(ctx: ToolContext, result: T): T {
  ctx.toolChars += JSON.stringify(result).length;
  if (ctx.toolChars > ctx.maxToolChars && ctx.stopReason == null) ctx.stopReason = "tool-budget";
  return result;
}

/** Embedded photos are huge base64 lines the model never needs to read. */
export function maskDataUrls(text: string): string {
  // Any long data: URL, base64 or not, whatever its mime type and parameters.
  return text.replace(/data:[a-z0-9.+/-]+(?:;[a-z0-9=.+-]+)*,[^\s)\]"'<>]{200,}/gi, (match) => {
    const comma = match.indexOf(",");
    return `${match.slice(0, comma + 1)}[${match.length - comma - 1} characters omitted]`;
  });
}

export function createTools(ctx: ToolContext) {
  const { env } = ctx;
  let editQueue: Promise<unknown> = Promise.resolve();

  const listFiles = tool({
    description: TOOL_DESCRIPTIONS.listFiles,
    inputSchema: z
      .object({
        folder: z.string().optional().describe("Folder relative to the workspace root. Omit for the root.")
      })
      .strict(),
    execute: async ({ folder }) => {
      const checked = normalizeWorkspacePath(folder ?? "");
      if (!checked.ok) return account(ctx, fail(checked.reason));
      const entries = await env.listFiles(checked.path);
      if (entries == null) return account(ctx, fail(`The folder "${checked.path}" does not exist.`));
      const shown = entries.slice(0, MAX_LIST);
      return account(ctx, {
        ok: true as const,
        folder: checked.path,
        entries: shown.map((e) => ({ path: e.path, isDirectory: e.isDirectory })),
        truncated: entries.length > shown.length
      });
    }
  });

  const search = tool({
    description: TOOL_DESCRIPTIONS.search,
    inputSchema: z
      .object({
        query: z.string().min(1),
        field: z.enum(["title", "path", "tags", "body"]).optional(),
        limit: z.number().int().min(1).max(20).optional()
      })
      .strict(),
    execute: async ({ query, field, limit }) => {
      const hits = await env.search(query, field, limit ?? 8);
      return account(ctx, {
        ok: true as const,
        hits: hits.slice(0, limit ?? 8).map((h) => ({ ...h, snippet: maskDataUrls(h.snippet).slice(0, 400) })),
        note: hits.length === 0 ? "No matches. Try other words or listFiles." : undefined
      });
    }
  });

  const readFile = tool({
    description: TOOL_DESCRIPTIONS.readFile,
    inputSchema: z
      .object({
        path: z.string().min(1),
        startLine: z.number().int().min(1).optional(),
        endLine: z.number().int().min(1).optional()
      })
      .strict(),
    execute: async ({ path, startLine, endLine }) => {
      const checked = normalizeWorkspacePath(path);
      if (!checked.ok) return account(ctx, fail(checked.reason));
      if (checked.path === "") return account(ctx, fail("Give a file path, not the workspace root."));
      const text = await env.readFile(checked.path);
      if (text == null) {
        return account(
          ctx,
          fail(`The file "${checked.path}" does not exist. Use listFiles or search to find the right path.`)
        );
      }
      const clean = (text.startsWith("\uFEFF") ? text.slice(1) : text).replace(/\r\n/g, "\n");
      const lines = maskDataUrls(clean).split("\n");
      const total = lines.length;
      if (startLine != null && startLine > total) {
        return account(ctx, fail(`startLine ${startLine} is beyond the end of the file (${total} lines).`));
      }
      const from = startLine ?? 1;
      const requestedTo = Math.min(endLine ?? total, total);
      if (requestedTo < from) return account(ctx, fail(`endLine ${requestedTo} is before startLine ${from}.`));
      // Read in chunks of whole lines (never a partial line): stop at the line or
      // character limit, whichever comes first, but always return at least one line.
      let to = from;
      let size = lines[from - 1]!.length;
      while (to < requestedTo && to - from + 1 < READ_CHUNK_LINES && size + lines[to]!.length + 1 <= READ_CHUNK_CHARS) {
        size += lines[to]!.length + 1;
        to += 1;
      }
      const more = to < requestedTo;
      const body = lines.slice(from - 1, to).join("\n");
      const content = more
        ? `${body}\n\n[Showing lines ${from}-${to} of ${total}. Use startLine=${to + 1} to continue, only if you need more.]`
        : body;
      return account(ctx, {
        ok: true as const,
        path: checked.path,
        startLine: from,
        endLine: to,
        totalLines: total,
        truncated: more,
        ...(more ? { nextStartLine: to + 1 } : {}),
        content
      });
    }
  });

  const writeFile = tool({
    description: TOOL_DESCRIPTIONS.writeFile,
    inputSchema: z
      .object({
        path: z.string().min(1),
        content: z.string().min(1).max(MAX_NEW_FILE_CHARS)
      })
      .strict(),
    execute: async ({ path, content }) => {
      const run = async () => {
        if (!env.canCreateFiles()) {
          return account(
            ctx,
            fail("No folder is open, so there is nowhere to create a file. Ask the user to open a folder.")
          );
        }
        const checked = normalizeWorkspacePath(path);
        if (!checked.ok) return account(ctx, fail(checked.reason));
        if (!checked.path.toLowerCase().endsWith(".md")) {
          return account(ctx, fail("writeFile creates markdown files only. The path must end in .md."));
        }
        if (checked.path.split("/").some((segment) => !isPortableName(segment))) {
          return account(
            ctx,
            fail('Each name in the path must be at most 200 characters and must not contain : * ? " < > |.')
          );
        }
        const existing = await env.readFile(checked.path);
        if (existing != null) {
          return account(
            ctx,
            fail(`The file "${checked.path}" already exists. Use editFile to change it. No file was written.`)
          );
        }
        const text = content.replace(/\r\n/g, "\n");
        const errors = [...env.diagnostics(text), ...unclosedDirectives(text)]
          .filter((d) => d.severity === "error")
          .slice(0, 5)
          .map((d) => (d.line ? `line ${d.line}: ${d.message}` : d.message));
        if (errors.length > 0) {
          return account(
            ctx,
            fail(`This file would contain errors: ${errors.join("; ")}. Fix the text. No file was written.`)
          );
        }
        const decision = await env.proposeEdit(
          {
            id: newProposalId(),
            path: checked.path,
            before: "",
            after: text,
            edits: [{ oldText: "", newText: text, line: 1 }],
            create: true
          },
          ctx.signal
        );
        if (decision.status === "applied") {
          return account(ctx, {
            ok: true as const,
            status: "applied" as const,
            message: `The user created ${checked.path}. Use readFile if you need to edit it.`
          });
        }
        if (decision.status === "rejected") {
          return account(ctx, {
            ok: true as const,
            status: "rejected" as const,
            message: "The user declined this new file. Do not propose the same file again; ask what they want instead."
          });
        }
        return account(
          ctx,
          fail(`The file could not be created: ${decision.reason} No file was written.`)
        );
      };
      const next = editQueue.then(run, run);
      editQueue = next.catch(() => undefined);
      return next;
    }
  });

  const editFile = tool({
    description: TOOL_DESCRIPTIONS.editFile,
    inputSchema: z
      .object({
        path: z.string().min(1),
        edits: z
          .array(z.object({ oldText: z.string(), newText: z.string() }).strict())
          .min(1)
      })
      .strict(),
    execute: async ({ path, edits }) => {
      // Edits to one workspace are serialized so two cards never race on one buffer.
      const run = async () => {
        const checked = normalizeWorkspacePath(path);
        if (!checked.ok) return account(ctx, fail(checked.reason));
        const source = await env.readFile(checked.path);
        if (source == null) {
          return account(
            ctx,
            fail(`The file "${checked.path}" does not exist. editFile cannot create files.`)
          );
        }
        const applied = applyEdits(source, edits);
        if (!applied.ok) return account(ctx, fail(applied.message));

        const check = (text: string) => [...env.diagnostics(text), ...unclosedDirectives(text)];
        const before = check(source);
        const seen = new Map<string, number>();
        for (const d of before) seen.set(d.message, (seen.get(d.message) ?? 0) + 1);
        const added: string[] = [];
        for (const d of check(applied.result)) {
          if (d.severity !== "error") continue;
          const left = seen.get(d.message) ?? 0;
          if (left > 0) seen.set(d.message, left - 1);
          else added.push(d.line ? `line ${d.line}: ${d.message}` : d.message);
        }
        if (added.length > 0) {
          return account(
            ctx,
            fail(
              `This edit would introduce errors: ${added.slice(0, 5).join("; ")}. ` +
                "Fix the edit so the result stays valid. No edit was applied."
            )
          );
        }

        const decision = await env.proposeEdit(
          { id: newProposalId(), path: checked.path, before: source, after: applied.result, edits: applied.edits },
          ctx.signal
        );
        if (decision.status === "applied") {
          return account(ctx, {
            ok: true as const,
            status: "applied" as const,
            message: `The user applied the edit to ${checked.path}. Use readFile for the new text if you need to edit it again.`
          });
        }
        if (decision.status === "rejected") {
          return account(ctx, {
            ok: true as const,
            status: "rejected" as const,
            message:
              "The user declined this edit. Do not propose the same change again; ask what they want instead."
          });
        }
        return account(
          ctx,
          fail(
            `The edit could not be applied: ${decision.reason} Call readFile to see the current text, then try again. No edit was applied.`
          )
        );
      };
      const next = editQueue.then(run, run);
      editQueue = next.catch(() => undefined);
      return next;
    }
  });

  return { listFiles, search, readFile, editFile, writeFile };
}

export type AssistantTools = ReturnType<typeof createTools>;

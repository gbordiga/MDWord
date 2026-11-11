import { unclosedDirectives } from "./directives";
import { tool } from "ai";
import { z } from "zod";
import { applyEdits } from "./edits";
import { normalizeWorkspacePath } from "./paths";
import { TOOL_DESCRIPTIONS } from "./prompt";
import { agentFileIssues, agentFileKind } from "./skills";
import { SHELL_DEFAULT_TIMEOUT_MS, SHELL_MAX_COMMAND_CHARS, SHELL_MAX_TIMEOUT_MS } from "@mdword/shared";
import { READ_CHUNK_CHARS, READ_CHUNK_LINES } from "./truncate";
import type { AssistantEnv, StopReason } from "./types";

export interface ToolContext {
  env: AssistantEnv;
  signal?: AbortSignal;
  maxToolChars: number;
  toolChars: number;
  /** Set when a tool decides the turn must end after the current step. */
  stopReason: StopReason | null;
  /** Text the user did not write has reached the model this turn (see `CommandRequest.tainted`). */
  tainted?: boolean;
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

/** Last line of defence: nothing returned to the model keeps image or binary payloads. */
function account<T extends object>(ctx: ToolContext, result: T): T {
  const safe = scrubForModel(result);
  ctx.toolChars += JSON.stringify(safe).length;
  if (ctx.toolChars > ctx.maxToolChars && ctx.stopReason == null) ctx.stopReason = "tool-budget";
  return safe;
}

const DATA_IMAGE = /data:image\/[a-z0-9.+-]+(?:;[a-z0-9=.+-]+)*,[^\s)\]"'<>\[]+/gi;
const DATA_URL = /data:[a-z0-9.+/-]+(?:;[a-z0-9=.+-]+)*,[^\s)\]"'<>\[]{80,}/gi;
/** Base64 that may be wrapped with spaces or line breaks. Letters alone are not enough. */
const WRAPPED_BASE64 = /(?:[A-Za-z0-9+/]{4}[\t ]*(?:\r?\n[\t ]*)?){20,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g;

function omitPayload(prefix: string, payload: string): string {
  return `${prefix}[${payload.length} characters omitted]`;
}

/** Embedded photos and other binary payloads the model must never receive. */
export function maskDataUrls(text: string): string {
  const withoutImages = text.replace(DATA_IMAGE, (match) => {
    const comma = match.indexOf(",");
    return omitPayload(match.slice(0, comma + 1), match.slice(comma + 1));
  });
  const withoutUrls = withoutImages.replace(DATA_URL, (match) => {
    const comma = match.indexOf(",");
    return omitPayload(match.slice(0, comma + 1), match.slice(comma + 1));
  });
  return withoutUrls.replace(WRAPPED_BASE64, (match) => {
    const compact = match.replace(/\s/g, "");
    if (compact.length < 80 || !/[+/=]/.test(compact)) return match;
    return `[${compact.length} characters of base64 omitted]`;
  });
}

/** Walk a tool result or message and replace every payload string. */
export function scrubForModel<T>(value: T): T {
  if (typeof value === "string") return maskDataUrls(value) as T;
  if (Array.isArray(value)) return value.map((item) => scrubForModel(item)) as T;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.type === "image" || record.type === "file") {
      return { type: "text", text: "[binary omitted]" } as T;
    }
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(record)) out[key] = scrubForModel(item);
    return out as T;
  }
  return value;
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

  const listDocuments = env.listDocuments
    ? tool({
        description: TOOL_DESCRIPTIONS.listDocuments,
        inputSchema: z
          .object({
            folder: z.string().optional().describe("Folder relative to the workspace root. Omit for the root.")
          })
          .strict(),
        execute: async ({ folder }) => {
          const checked = normalizeWorkspacePath(folder ?? "");
          if (!checked.ok) return account(ctx, fail(checked.reason));
          const entries = await env.listDocuments!(checked.path);
          if (entries == null) return account(ctx, fail(`The folder "${checked.path}" does not exist.`));
          const shown = entries.slice(0, MAX_LIST);
          return account(ctx, {
            ok: true as const,
            folder: checked.path,
            entries: shown.map((e) => ({ path: e.path, isDirectory: e.isDirectory })),
            truncated: entries.length > shown.length
          });
        }
      })
    : null;

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
        note: hits.length === 0 ? "No matches. Try other words, listFiles, or listDocuments." : undefined
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
      if (/\.(docx|pptx|xlsx|pdf)$/i.test(checked.path)) {
        return account(ctx, fail(`Use readDocument for "${checked.path}". readFile is for markdown and text.`));
      }
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

  const readDocument = tool({
    description: TOOL_DESCRIPTIONS.readDocument,
    inputSchema: z
      .object({
        path: z.string().min(1),
        saveAs: z
          .string()
          .min(1)
          .optional()
          .describe("Markdown path to create from this file, when the user asked to convert it. Omit to only read.")
      })
      .strict(),
    execute: async ({ path, saveAs }) => {
      const read = env.readDocument;
      if (!read) return account(ctx, fail("Reading office and PDF files is not available here."));
      const checked = normalizeWorkspacePath(path);
      if (!checked.ok) return account(ctx, fail(checked.reason));
      if (!/\.(docx|pptx|xlsx|pdf)$/i.test(checked.path)) {
        return account(ctx, fail("readDocument reads docx, pptx, xlsx, and pdf files. Use readFile for markdown."));
      }
      try {
        const markdown = await read(checked.path);
        if (markdown == null) {
          return account(ctx, fail(`The file "${checked.path}" does not exist. Use listFiles to find the right path.`));
        }
        const preview = maskDataUrls(markdown);
        const shown = preview.length > 60_000 ? `${preview.slice(0, 60_000)}\n\n[Extract truncated.]` : preview;
        if (!saveAs) return account(ctx, { ok: true as const, path: checked.path, markdown: shown });
        if (!env.canCreateFiles()) {
          return account(ctx, fail("No folder is open, so the conversion cannot be saved."));
        }
        const target = normalizeWorkspacePath(saveAs);
        if (!target.ok) return account(ctx, fail(target.reason));
        if (!target.path.toLowerCase().endsWith(".md")) {
          return account(ctx, fail("saveAs must be a markdown path ending in .md."));
        }
        if ((await env.readFile(target.path)) != null) {
          return account(ctx, fail(`The file "${target.path}" already exists. No file was written.`));
        }
        const decision = await env.proposeEdit(
          {
            id: newProposalId(),
            path: target.path,
            before: "",
            after: markdown,
            edits: [{ oldText: "", newText: markdown, line: 1 }],
            create: true
          },
          ctx.signal
        );
        if (decision.status === "rejected") {
          return account(ctx, {
            ok: true as const,
            status: "rejected" as const,
            message: "The user declined this conversion. Do not propose the same file again."
          });
        }
        if (decision.status !== "applied") {
          return account(ctx, fail(`The conversion could not be saved: ${decision.reason}`));
        }
        return account(ctx, {
          ok: true as const,
          status: "applied" as const,
          path: target.path,
          message: `The user created ${target.path} from ${checked.path}. Photos are embedded the same way as in other markdown files. Use readFile to see it; image bytes stay hidden.`
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "The file could not be read.";
        return account(ctx, fail(message));
      }
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
        const agentIssues = agentFileIssues(checked.path, text);
        if (agentIssues && agentIssues.length > 0) {
          return account(
            ctx,
            fail(`This ${agentFileKind(checked.path)} would not work: ${agentIssues.slice(0, 5).join(" ")} No file was written.`)
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
        const agentAfter = agentFileIssues(checked.path, applied.result);
        if (agentAfter && agentAfter.length > 0) {
          const known = new Set(agentFileIssues(checked.path, source) ?? []);
          const introduced = agentAfter.filter((issue) => !known.has(issue));
          if (introduced.length > 0) {
            return account(
              ctx,
              fail(
                `This ${agentFileKind(checked.path)} would stop working: ${introduced.slice(0, 5).join(" ")} No edit was applied.`
              )
            );
          }
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

  const runCommand = tool({
    description: TOOL_DESCRIPTIONS.runCommand,
    inputSchema: z
      .object({
        shell: z.enum(["bash", "powershell"]).describe("Which shell runs the command."),
        command: z.string().min(1).max(SHELL_MAX_COMMAND_CHARS),
        folder: z.string().optional().describe("Folder relative to the workspace root. Omit for the root."),
        timeoutSeconds: z.number().int().min(1).max(SHELL_MAX_TIMEOUT_MS / 1000).optional()
      })
      .strict(),
    execute: async ({ shell, command, folder, timeoutSeconds }) => {
      const run = env.runCommand;
      if (!run) return account(ctx, fail("Commands are not available here."));
      const checked = normalizeWorkspacePath(folder ?? "");
      if (!checked.ok) return account(ctx, fail(checked.reason));
      const outcome = await run(
        {
          shell,
          command,
          folder: checked.path,
          timeoutMs: timeoutSeconds ? timeoutSeconds * 1000 : SHELL_DEFAULT_TIMEOUT_MS,
          tainted: ctx.tainted === true
        },
        ctx.signal
      );
      if (outcome.status === "denied") {
        return account(ctx, {
          ok: true as const,
          status: "denied" as const,
          message: "The user did not allow this command. Do not run it again; ask what they want instead."
        });
      }
      if (outcome.status === "failed") return account(ctx, fail(outcome.reason));
      return account(ctx, {
        ok: true as const,
        status: "ran" as const,
        exitCode: outcome.exitCode,
        timedOut: outcome.timedOut,
        cancelled: outcome.cancelled,
        truncated: outcome.truncated,
        durationMs: outcome.durationMs,
        changedFiles: outcome.changed.length > 0 ? outcome.changed : undefined,
        output: outcome.output
      });
    }
  });

  const generateImage = tool({
    description: TOOL_DESCRIPTIONS.generateImage,
    inputSchema: z
      .object({
        prompt: z.string().min(1).max(2000),
        alt: z.string().min(1).max(200).describe("Short alternative text for the picture.")
      })
      .strict(),
    execute: async ({ prompt, alt }) => {
      const generate = env.generateImage;
      if (!generate) return account(ctx, fail("Image generation is not available here."));
      const outcome = await generate(prompt, alt, ctx.signal);
      if (outcome.status === "inserted") {
        return account(ctx, {
          ok: true as const,
          status: "inserted" as const,
          path: outcome.path,
          id: outcome.id,
          message: `The user added the picture to ${outcome.path} as ![${alt}][${outcome.id}]. Move it with editFile if it should not stay at the end. Do not copy the image bytes.`
        });
      }
      if (outcome.status === "rejected") {
        return account(ctx, {
          ok: true as const,
          status: "rejected" as const,
          message: "The user declined this picture. Do not generate the same one again."
        });
      }
      return account(ctx, fail(outcome.reason));
    }
  });

  const deleteFile = tool({
    description: TOOL_DESCRIPTIONS.deleteFile,
    inputSchema: z.object({ path: z.string().min(1) }).strict(),
    execute: async ({ path }) => {
      const checked = normalizeWorkspacePath(path);
      if (!checked.ok) return account(ctx, fail(checked.reason));
      if (checked.path === "") return account(ctx, fail("Give a file path, not the workspace root."));
      if (!env.canCreateFiles()) {
        return account(ctx, fail("No folder is open, so there is no project to delete a file from."));
      }
      const decision = await env.proposeDelete(checked.path, ctx.signal);
      if (decision.status === "deleted") {
        return account(ctx, {
          ok: true as const,
          status: "deleted" as const,
          message: `The user deleted ${checked.path}.`
        });
      }
      if (decision.status === "rejected") {
        return account(ctx, {
          ok: true as const,
          status: "rejected" as const,
          message: "The user kept this file. Do not try to delete it again; ask what they want instead."
        });
      }
      return account(ctx, fail(decision.reason));
    }
  });

  return {
    listFiles,
    ...(listDocuments ? { listDocuments } : {}),
    search,
    readFile,
    readDocument,
    editFile,
    writeFile,
    deleteFile,
    ...(env.generateImage ? { generateImage } : {}),
    ...(env.runCommand ? { runCommand } : {})
  };
}

export type AssistantTools = ReturnType<typeof createTools>;

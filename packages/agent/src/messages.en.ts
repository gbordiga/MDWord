/**
 * User-facing strings of the assistant. English is the first locale; every
 * string is a whole sentence with named parameters so a translator can reorder
 * words. Model-facing text (prompt, tool errors) is NOT here: it is always
 * English and lives next to the code that produces it.
 */
export const messagesEn = {
  "panel.title": "Assistant",
  "panel.close": "Close assistant",
  "panel.settings": "Assistant settings",
  "panel.newChat": "New chat",
  "panel.input.placeholder": "Ask a question. Type @ to add files as context",
  "panel.mention.list": "Files to add as context",
  "panel.mention.empty": "No files match {query}.",
  "panel.mention.empty.all": "This project has no documents to add.",
  "panel.mention.add": "Add a file as context",
  "panel.mention.hint": "Arrow keys move, Enter adds the file, and Escape closes this menu.",
  "panel.web.on": "Web search is on. Click to turn it off",
  "panel.web.off": "Web search is off. Click to turn it on",
  "panel.web.badge": "Web search on",
  "panel.instructions": "Following {names}",
  "panel.instructions.title": "Instruction files the assistant reads for this project: {paths}",
  "panel.input.hint": "Enter to send, Shift+Enter for a new line",
  "panel.input.disabled": "Sign in or add an OpenRouter key to start",
  "panel.send": "Send",
  "panel.stop": "Stop",
  "panel.suggest.summarize": "Summarize this document",
  "panel.suggest.proofread": "Fix spelling and grammar",
  "panel.suggest.structure": "Suggest a clearer structure",
  "panel.suggest.summarize.prompt": "Summarize the open document in a few sentences.",
  "panel.suggest.proofread.prompt": "Proofread the open document and propose fixes for spelling and grammar. Do not change the meaning or the style.",
  "panel.suggest.structure.prompt": "Review the structure of the open document and suggest a clearer outline. Do not edit anything yet.",
  "panel.empty.title": "Ask for help with your writing",
  "panel.empty.body":
    "The assistant can read your files and propose edits. Nothing changes until you press Apply.",
  "panel.context.file": "Context: {name}",
  "panel.cost.session": "Session: {cost}",
  "panel.cost.unknown": "Session cost unknown",
  "panel.nokey.title": "Connect OpenRouter",
  "panel.nokey.body":
    "The assistant uses your own OpenRouter account. Nothing is sent until you connect it.",
  "panel.nokey.open": "Open settings",
  "panel.thinking": "Thinking",
  "panel.thinking.web": "Thinking, searching the web if needed",
  "panel.work.steps": "{count, plural, one {# step} other {# steps}}",
  "panel.jumpLatest": "Jump to latest",
  "panel.history": "Past conversations",
  "history.title": "Conversations",
  "history.back": "Back to chat",
  "history.new": "New chat",
  "history.search": "Search conversations",
  "history.empty": "No conversations yet. Your chats in this workspace will appear here.",
  "history.noMatch": "No conversation matches your search.",
  "history.untitled": "Untitled conversation",
  "history.group.today": "Today",
  "history.group.yesterday": "Yesterday",
  "history.group.week": "Previous 7 days",
  "history.group.older": "Older",
  "history.delete": "Delete conversation",
  "history.delete.confirm": "Delete",
  "history.cancel": "Cancel",

  "tool.listFiles": "Listing files in {folder}",
  "tool.listFiles.root": "the workspace",
  "tool.search": "Searching for \u201c{query}\u201d",
  "tool.webSearch": "Searched the web: {sites}",
  "tool.readFile": "Reading {path}",
  "tool.readFile.range": "Reading {path}, lines {start} to {end}",
  "tool.editFile": "Proposing an edit to {path}",
  "tool.writeFile": "Proposing a new file {path}",
  "tool.runCommand": "Running a command",

  "edit.card.title": "Proposed edit to {path}",
  "edit.card.summary": "{count, plural, one {# change} other {# changes}}",
  "edit.card.titleNew": "Proposed new file {path}",
  "edit.card.new": "New file",
  "edit.created": "Created. Delete the file to remove it.",
  "edit.createFailed": "The file could not be created. Nothing was written.",
  "edit.apply": "Apply",
  "edit.discard": "Discard",
  "edit.applied": "Applied. You can undo it with one step.",
  "edit.discarded": "Discarded",
  "edit.stale": "The document changed, so this edit no longer applies. Nothing was written.",
  "edit.removed": "Removed",
  "edit.added": "Added",

  "stop.done": "",
  "stop.maxSteps": "Stopped: the assistant reached the step limit for one request.",
  "stop.toolBudget": "Stopped: the assistant read too much text for one request.",
  "stop.spendCap": "Stopped: the session spending limit was reached. Raise it in settings to continue.",
  "stop.failures": "Stopped: the same tool failed three times in a row.",
  "stop.aborted": "Stopped.",

  "error.auth": "OpenRouter rejected the key. Check it in settings.",
  "error.credits": "Your OpenRouter account is out of credits.",
  "error.rateLimit": "The model is busy or rate limited. Try again in a moment.",
  "error.model": "The selected model is not available. Choose another one in settings.",
  "error.privacy":
    "No provider for this model matches your privacy setting. Choose another model or change the setting.",
  "error.network": "Could not reach OpenRouter. Check your connection.",
  "error.secureStorage":
    "This system has no secure place to store the key. On Linux, install and unlock a keyring such as GNOME Keyring or KWallet, then try again.",
  "error.stalled": "The model stopped responding. Try again or choose another model.",
  "error.unknown": "The request failed.",

  "settings.title": "Assistant settings",
  "settings.back": "Back to chat",
  "settings.account": "OpenRouter account",
  "settings.signIn": "Sign in with OpenRouter",
  "settings.signingIn": "Waiting for OpenRouter",
  "settings.pasteKey": "Or paste an API key",
  "settings.key.placeholder": "sk-or-\u2026",
  "settings.key.save": "Save key",
  "settings.key.saved": "Key saved: {masked}",
  "settings.key.none": "No key saved",
  "settings.key.clear": "Remove key",
  "settings.key.note":
    "The key has no spending limit of its own. For a hard limit, create a dedicated key on openrouter.ai and paste it here.",
  "settings.model": "Model",
  "settings.model.suggested": "Suggested",
  "settings.model.all": "All models",
  "settings.model.failed": "Could not load the model list. Suggested models are still available.",
  "settings.model.price": "{input} in / {output} out per million tokens",
  "settings.model.search": "Search models",
  "settings.model.intelligence": "Intelligence",
  "settings.model.cost": "Cost",
  "settings.model.scoreNote": "Intelligence is the Artificial Analysis index reported by OpenRouter. Paler bars are estimated from the coding or agentic index. Cost is the price of a typical turn.",
  "settings.model.noScore": "No intelligence score",
  "settings.model.estimated": "Intelligence: about {value} (estimated from other benchmarks)",
  "settings.model.empty": "No model matches that search.",
  "settings.tier.low": "Low cost",
  "settings.tier.balanced": "Balanced",
  "settings.tier.quality": "Quality",
  "settings.cap": "Spending limit per session",
  "settings.cap.off": "No limit",
  "settings.cap.value": "{amount} per session",
  "settings.privacy": "Only use providers that do not keep my prompts",
  "settings.privacy.note":
    "Sends a routing preference to OpenRouter. Some models have only one provider and may become unavailable.",
  "settings.zdr": "Zero data retention only",
  "settings.zdr.note":
    "Stricter: only endpoints that keep nothing after answering. The model list shows only models that have one, so fewer models are available.",
  "settings.web": "Let the assistant search the web",
  "settings.web.note":
    "Off by default. When on, the model can send a short search query through OpenRouter: to the model's own provider if it has built-in search, otherwise to a search service (Exa). The model writes the query, and the privacy setting above does not cover search services. Each search is billed by OpenRouter, roughly $0.001 to $0.015, on top of the model.",
  "settings.history": "Chat history",
  "settings.history.clear": "Delete all conversations in this workspace",
  "settings.history.confirm": "Delete all",
  "settings.history.cancel": "Cancel",
  "settings.history.note": "History is stored on this device, outside your project.",
  "settings.notice.title": "Before you start",
  "settings.notice.body":
    "When you use the assistant, your messages and the parts of your documents it reads are sent to OpenRouter and to the model provider you choose. Their data policies apply. Nothing is sent when no key is set.",
  "settings.notice.accept": "I understand",
  "settings.signin.failed": "Sign in failed. You can paste a key instead.",
  "settings.signin.cancelled": "Sign in was cancelled.",
  "settings.shell": "Commands",
  "settings.shell.note":
    "Let the assistant run shell commands in this project. There is no sandbox: a command runs with your permissions, and text the assistant reads (files, web pages) can try to make it run something. Commands never see your OpenRouter key.",
  "settings.shell.unavailable": "Commands are only available in the desktop app, with a project folder open.",
  "settings.shell.noShell": "No bash or PowerShell was found on this computer.",
  "settings.shell.off": "Off",
  "settings.shellNote.off": "The assistant cannot run commands.",
  "settings.shell.manual": "Ask me every time",
  "settings.shellNote.manual": "Each command is shown first. You choose Run or Deny.",
  "settings.shell.ai": "Automatic, checked by AI",
  "settings.shellNote.ai":
    "An AI check sees only the command and allows it when that command is safe. Anything else, or an unclear answer, asks you.",
  "settings.shell.always": "Run without asking",
  "settings.shellNote.always":
    "Commands that pass the fixed read-only filter run with no question and no AI check. Everything else asks you.",
  "settings.shell.warn.title": "Turn on automatic commands?",
  "settings.shell.warn.body":
    "There is no sandbox. A command runs with your permissions. The fixed filter allows only plain read-only commands; anything else asks you. Switch back to Ask me every time at any moment.",
  "settings.shell.warn.confirm": "Turn on",
  "settings.shell.warn.cancel": "Keep asking me",
  "panel.shell.badge.manual": "Commands: ask",
  "panel.shell.badge.ai": "Commands: AI check",
  "panel.shell.badge.always": "Commands: no questions",
  "panel.shell.badge.title": "Choose how commands run in this project.",
  "command.card.title": "Command in {shell}",
  "command.folder": "Folder: {folder}",
  "command.root": "project folder",
  "command.run": "Run",
  "command.deny": "Deny",
  "command.stop": "Stop",
  "command.running": "Running…",
  "command.denied": "Not run.",
  "command.exit": "Exit code {code}, {seconds} s",
  "command.timedOut": "Stopped: the time limit ({seconds} s) was reached.",
  "command.cancelled": "Stopped.",
  "command.failed": "Could not run: {reason}",
  "command.approval.manual": "You approved this command.",
  "command.approval.ai": "Approved automatically after an AI check.",
  "command.approval.always": "Ran automatically without a question.",
  "command.needsYou": "Needs your approval: {reason}.",
  "command.aiDenied": "Needs your approval: the AI check did not allow it ({reason}).",
  "command.output": "Output",
  "command.output.empty": "(no output)",
  "command.changed": "Files changed by the command: {files}",
  "command.history": "Output is not saved with the chat.",
  "error.shell.noShell": "No bash or PowerShell was found on this computer.",
  "error.shell.busy": "Four commands are already running.",
  "error.shell.badFolder": "That folder is not inside the project.",
  "error.shell.badRoot": "Open the project folder again, then retry.",
  "error.shell.spawn": "The shell could not be started."
} as const;

export type MessageKey = keyof typeof messagesEn;
export type MessageParams = Record<string, string | number>;

/**
 * Minimal formatter: `{name}` substitution and one-level
 * `{n, plural, one {...} other {...}}` (ICU-compatible subset), so the
 * catalog can move to a full ICU library without rewriting strings.
 */
export function formatMessage(
  template: string,
  params: MessageParams = {},
  locale = "en"
): string {
  const plural = /\{(\w+), plural, one \{([^}]*)\} other \{([^}]*)\}\}/g;
  const withPlurals = template.replace(plural, (_m, name: string, one: string, other: string) => {
    const n = Number(params[name] ?? 0);
    const rule = new Intl.PluralRules(locale).select(n);
    return (rule === "one" ? one : other).replace(/#/g, String(n));
  });
  return withPlurals.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m
  );
}

export function t(key: MessageKey, params?: MessageParams): string {
  return formatMessage(messagesEn[key], params);
}

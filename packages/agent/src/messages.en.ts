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
  "panel.input.placeholder": "Ask about this document or workspace",
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

  "edit.card.title": "Proposed edit to {path}",
  "edit.card.summary": "{count, plural, one {# change} other {# changes}}",
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
  "settings.tier.low": "Low cost",
  "settings.tier.balanced": "Balanced",
  "settings.tier.quality": "Quality",
  "settings.cap": "Spending limit per session",
  "settings.cap.off": "No limit",
  "settings.cap.value": "{amount} per session",
  "settings.privacy": "Only use providers that do not keep my prompts",
  "settings.privacy.note":
    "Sends a routing preference to OpenRouter. Some models have only one provider and may become unavailable.",
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
  "settings.signin.cancelled": "Sign in was cancelled."
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

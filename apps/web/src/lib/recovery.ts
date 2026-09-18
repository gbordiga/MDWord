import { getHost } from "./host";

export const RECOVERY_ID = "current";
export const RECOVERY_META_ID = "current.meta";
const MAX_CRASH_DRAFT_CHARS = 1_500_000;
let lastWrittenContent = "";

export type RecoveryMeta = {
  path: string | null;
  title?: string;
  updatedMs?: number;
};

export async function writeCrashDraft(content: string, meta: RecoveryMeta): Promise<void> {
  const payload = content.length > MAX_CRASH_DRAFT_CHARS ? content.slice(0, MAX_CRASH_DRAFT_CHARS) : content;
  if (payload === lastWrittenContent) return;
  const host = getHost();
  await host.app.writeRecovery(RECOVERY_ID, payload, { ...meta, updatedMs: Date.now() });
  await host.app.writeRecovery(RECOVERY_META_ID, JSON.stringify({ ...meta, updatedMs: Date.now() }), {
    path: meta.path
  });
  lastWrittenContent = payload;
}

export async function readCrashDraft(): Promise<{ content: string; meta: RecoveryMeta } | null> {
  const host = getHost();
  const content = await host.app.readRecovery(RECOVERY_ID);
  if (!content) return null;
  let meta: RecoveryMeta = { path: null };
  const raw = await host.app.readRecovery(RECOVERY_META_ID);
  if (raw) {
    try {
      meta = JSON.parse(raw) as RecoveryMeta;
    } catch {
      meta = { path: null };
    }
  }
  return { content, meta };
}

export async function clearCrashDraft(): Promise<void> {
  lastWrittenContent = "";
  const host = getHost();
  await host.app.clearRecovery(RECOVERY_ID);
  await host.app.clearRecovery(RECOVERY_META_ID);
}

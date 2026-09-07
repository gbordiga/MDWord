import { getHost } from "./host";

export const RECOVERY_ID = "current";
export const RECOVERY_META_ID = "current.meta";

export type RecoveryMeta = {
  path: string | null;
  title?: string;
  updatedMs?: number;
};

export async function writeCrashDraft(content: string, meta: RecoveryMeta): Promise<void> {
  const host = getHost();
  await host.app.writeRecovery(RECOVERY_ID, content, { ...meta, updatedMs: Date.now() });
  await host.app.writeRecovery(RECOVERY_META_ID, JSON.stringify({ ...meta, updatedMs: Date.now() }), {
    path: meta.path
  });
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
  const host = getHost();
  await host.app.clearRecovery(RECOVERY_ID);
  await host.app.clearRecovery(RECOVERY_META_ID);
}

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatPerMillion,
  t,
  type ModelInfo,
  type SuggestedModel,
  type Tier
} from "@mdword/agent";
import { ArrowLeft } from "lucide-react";
import { getHost } from "@/lib/host";
import { useAssistant } from "@/lib/assistant/store";

const CAPS: (number | null)[] = [1, 3, 5, 10, 25, null];
const TIERS: Tier[] = ["low", "balanced", "quality"];

function Row({ label, children, note }: { label: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="space-y-1.5">
      {label ? <div className="text-[12px] font-medium text-[#344054]">{label}</div> : null}
      {children}
      {note ? <p className="text-[11px] leading-snug text-[#667085]">{note}</p> : null}
    </div>
  );
}

const controlClass =
  "w-full rounded-md border border-[#d0d5dd] bg-white px-2 py-1.5 text-[12px] text-[#1c1f24] focus:border-accent focus:outline-none";
const buttonClass =
  "rounded-md border border-[#d0d5dd] px-2.5 py-1.5 text-[12px] font-medium text-[#344054] hover:bg-[#f2f4f7] disabled:opacity-50";

function describeModel(id: string, models: ModelInfo[] | null): string {
  const info = models?.find((m) => m.id === id);
  if (!info) return id;
  return `${id} \u2014 ${t("settings.model.price", {
    input: formatPerMillion(info.promptPrice),
    output: formatPerMillion(info.completionPrice)
  })}`;
}

export function AssistantSettings() {
  const s = useAssistant();
  const [draft, setDraft] = useState("");
  const [keyError, setKeyError] = useState<null | "invalid" | "storage">(null);
  const host = getHost().assistant;

  const { loadModels } = s;
  const hasKey = s.key?.hasKey ?? false;
  const haveModels = s.models != null;
  const modelsFailed = s.modelsFailed;
  useEffect(() => {
    if (hasKey && !haveModels && !modelsFailed) void loadModels();
  }, [hasKey, haveModels, modelsFailed, loadModels]);

  const suggestedIds = useMemo(() => new Set(s.usableSuggested.map((m) => m.id)), [s.usableSuggested]);
  const others = useMemo(
    () =>
      (s.models ?? [])
        .filter((m) => m.supportsTools && !m.expired && !suggestedIds.has(m.id))
        .sort((a, b) => a.id.localeCompare(b.id)),
    [s.models, suggestedIds]
  );
  const current = s.settings.modelId;
  const currentListed = suggestedIds.has(current) || others.some((m) => m.id === current);

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="assistant-settings">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-[#e4e7ec] px-2 py-2">
        <button
          type="button"
          aria-label={t("settings.back")}
          title={t("settings.back")}
          data-testid="assistant-settings-back"
          className="rounded-md p-1 text-[#667085] hover:bg-[#f2f4f7] hover:text-[#1c1f24]"
          onClick={() => s.setView("chat")}
        >
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[#667085]">{t("settings.title")}</h2>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3">
        {!s.settings.noticeAccepted ? (
          <section className="space-y-2 rounded-lg border border-[#fedf89] bg-[#fffaeb] p-2.5" data-testid="assistant-notice">
            <h3 className="text-[12px] font-semibold text-[#93370d]">{t("settings.notice.title")}</h3>
            <p className="text-[12px] leading-snug text-[#7a2e0e]">{t("settings.notice.body")}</p>
            <button
              type="button"
              data-testid="assistant-notice-accept"
              className="rounded-md bg-accent px-2.5 py-1.5 text-[12px] font-medium text-white"
              onClick={() => s.updateSettings({ noticeAccepted: true })}
            >
              {t("settings.notice.accept")}
            </button>
          </section>
        ) : null}

        <Row label={t("settings.account")} note={s.key?.hasKey ? t("settings.key.note") : undefined}>
          {s.key?.hasKey ? (
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[#344054]" data-testid="assistant-key-masked">
                {t("settings.key.saved", { masked: s.key.masked ?? "" })}
              </span>
              <button type="button" className={buttonClass} data-testid="assistant-key-clear" onClick={() => void s.clearKey()}>
                {t("settings.key.clear")}
              </button>
            </div>
          ) : (
            <p className="text-[12px] text-[#667085]">{t("settings.key.none")}</p>
          )}
          {!s.key?.hasKey ? (
            <div className="space-y-2">
              <button
                type="button"
                data-testid="assistant-sign-in"
                className="w-full rounded-md bg-accent px-2.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-60"
                disabled={s.signIn === "waiting"}
                onClick={() => void s.startSignIn()}
              >
                {s.signIn === "waiting" ? t("settings.signingIn") : t("settings.signIn")}
              </button>
              {s.signIn === "waiting" && host?.cancelSignIn ? (
                <button type="button" className={buttonClass} onClick={() => void s.cancelSignIn()}>
                  {t("panel.stop")}
                </button>
              ) : null}
              {s.signIn === "failed" ? (
                <p className="text-[12px] text-[#b42318]" role="alert">
                  {t("settings.signin.failed")}
                </p>
              ) : null}
              {s.signIn === "cancelled" ? (
                <p className="text-[12px] text-[#667085]">{t("settings.signin.cancelled")}</p>
              ) : null}
              <label className="block space-y-1">
                <span className="text-[11px] text-[#667085]">{t("settings.pasteKey")}</span>
                <div className="flex gap-1.5">
                  <input
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    data-testid="assistant-key-input"
                    className={controlClass}
                    placeholder={t("settings.key.placeholder")}
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      setKeyError(null);
                    }}
                  />
                  <button
                    type="button"
                    data-testid="assistant-key-save"
                    className={buttonClass}
                    disabled={!draft.trim()}
                    onClick={async () => {
                      const result = await s.saveKey(draft);
                      if (result === "ok") setDraft("");
                      else setKeyError(result);
                    }}
                  >
                    {t("settings.key.save")}
                  </button>
                </div>
              </label>
              {keyError ? (
                <p className="text-[12px] text-[#b42318]" role="alert">
                  {keyError === "storage" ? t("error.secureStorage") : t("error.auth")}
                </p>
              ) : null}
            </div>
          ) : null}
        </Row>

        <Row label={t("settings.model")} note={s.modelsFailed ? t("settings.model.failed") : undefined}>
          <select
            aria-label={t("settings.model")}
            data-testid="assistant-model"
            className={controlClass}
            value={current}
            onChange={(e) => s.updateSettings({ modelId: e.target.value })}
          >
            {!currentListed ? <option value={current}>{describeModel(current, s.models)}</option> : null}
            <optgroup label={t("settings.model.suggested")}>
              {TIERS.flatMap((tier) =>
                s.usableSuggested
                  .filter((m: SuggestedModel) => m.tier === tier)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {`${t(`settings.tier.${tier}` as const)}: ${describeModel(m.id, s.models)}`}
                    </option>
                  ))
              )}
            </optgroup>
            {others.length > 0 ? (
              <optgroup label={t("settings.model.all")}>
                {others.map((m) => (
                  <option key={m.id} value={m.id}>
                    {describeModel(m.id, s.models)}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </Row>

        <Row label={t("settings.cap")}>
          <select
            aria-label={t("settings.cap")}
            data-testid="assistant-cap"
            className={controlClass}
            value={s.settings.spendCapUsd === null ? "off" : String(s.settings.spendCapUsd)}
            onChange={(e) => s.updateSettings({ spendCapUsd: e.target.value === "off" ? null : Number(e.target.value) })}
          >
            {CAPS.map((cap) => (
              <option key={cap ?? "off"} value={cap === null ? "off" : String(cap)}>
                {cap === null ? t("settings.cap.off") : t("settings.cap.value", { amount: `$${cap}` })}
              </option>
            ))}
          </select>
        </Row>

        <Row label="" note={t("settings.privacy.note")}>
          <label className="flex items-center gap-2 text-[12px] text-[#344054]">
            <input
              type="checkbox"
              data-testid="assistant-privacy"
              checked={s.settings.privacyOnly}
              onChange={(e) => s.updateSettings({ privacyOnly: e.target.checked })}
            />
            {t("settings.privacy")}
          </label>
        </Row>

        <Row label={t("settings.history")} note={t("settings.history.note")}>
          <button type="button" className={buttonClass} data-testid="assistant-clear-history" onClick={() => void s.clearHistory()}>
            {t("settings.history.clear")}
          </button>
        </Row>
      </div>
    </div>
  );
}

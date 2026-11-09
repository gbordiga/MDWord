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
import { shellModeOf, useAssistant } from "@/lib/assistant/store";
import { useApp } from "@/lib/store";
import type { ShellMode } from "@mdword/shared";

const CAPS: (number | null)[] = [1, 3, 5, 10, 25, null];
const TIERS: Tier[] = ["low", "balanced", "quality"];

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      {title ? <h3 className="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#667085]">{title}</h3> : null}
      <div className="space-y-2 rounded-xl border border-[#e4e7ec] bg-white p-2.5">{children}</div>
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  note,
  testId
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  note: string;
  testId: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg px-1 py-1 hover:bg-[#f9fafb]">
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-medium text-[#1c1f24]">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-[#667085]">{note}</span>
      </span>
      <span className="relative mt-0.5 inline-flex h-5 w-9 shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          data-testid={testId}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="absolute inset-0 rounded-full bg-[#d0d5dd] transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent" />
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
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

const SHELL_CHOICES: ShellMode[] = ["off", "manual", "ai", "always"];

function ShellSection() {
  const s = useAssistant();
  const [asking, setAsking] = useState<ShellMode | null>(null);
  const hasFolder = useApp((a) => Boolean(a.workspace?.root));
  const api = getHost().assistant?.shell;
  const { refreshShell } = s;
  useEffect(() => {
    if (api) void refreshShell();
  }, [api, refreshShell]);
  const mode = shellModeOf(s);
  const avail = s.shellAvailability;
  const noShell = avail != null && !avail.bash && !avail.powershell;
  if (!api || !hasFolder) {
    return (
      <Section title={t("settings.shell")}>
        <p className="px-1 text-[11px] leading-snug text-[#667085]">{t("settings.shell.unavailable")}</p>
      </Section>
    );
  }
  const choose = (next: ShellMode) => {
    if (next === "ai" || next === "always") setAsking(next);
    else {
      setAsking(null);
      s.setShellMode(next);
    }
  };
  return (
    <Section title={t("settings.shell")}>
      <p className="px-1 text-[11px] leading-snug text-[#667085]">{t("settings.shell.note")}</p>
      <div role="radiogroup" aria-label={t("settings.shell")} className="space-y-1.5" data-testid="assistant-shell-modes">
        {SHELL_CHOICES.map((choice) => {
          const selected = mode === choice;
          return (
            <label
              key={choice}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-[12px] ${
                selected ? "border-accent bg-[#f5f8ff]" : "border-[#e4e7ec] hover:bg-[#f9fafb]"
              } ${choice !== "off" && noShell ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <input
                type="radio"
                name="assistant-shell-mode"
                className="mt-0.5 accent-accent"
                data-testid={`assistant-shell-${choice}`}
                checked={selected}
                disabled={choice !== "off" && noShell}
                onChange={() => choose(choice)}
              />
              <span>
                <span className="font-medium text-[#1c1f24]">{t(`settings.shell.${choice}`)}</span>
                <span className="block text-[11px] leading-snug text-[#667085]">{t(`settings.shellNote.${choice}`)}</span>
              </span>
            </label>
          );
        })}
      </div>
      {noShell ? <p className="px-1 text-[11px] text-[#b54708]">{t("settings.shell.noShell")}</p> : null}
      {asking ? (
        <div className="space-y-2 rounded-lg border border-[#fedf89] bg-[#fffaeb] p-2.5" data-testid="assistant-shell-warning">
          <h4 className="text-[12px] font-semibold text-[#93370d]">{t("settings.shell.warn.title")}</h4>
          <p className="text-[11px] leading-snug text-[#93370d]">{t("settings.shell.warn.body")}</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md bg-[#1c1f24] px-2.5 py-1.5 text-[12px] font-medium text-white"
              data-testid="assistant-shell-confirm"
              onClick={() => {
                s.setShellMode(asking);
                setAsking(null);
              }}
            >
              {t("settings.shell.warn.confirm")}
            </button>
            <button type="button" className={buttonClass} onClick={() => setAsking(null)}>
              {t("settings.shell.warn.cancel")}
            </button>
          </div>
        </div>
      ) : null}
    </Section>
  );
}

export function AssistantSettings() {
  const s = useAssistant();
  const [draft, setDraft] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
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
      <div className="min-h-0 flex-1 space-y-5 overflow-auto bg-[#f9fafb] p-3">
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

        <Section title={t("settings.account")}>
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
          {s.key?.hasKey ? <p className="px-1 text-[11px] leading-snug text-[#667085]">{t("settings.key.note")}</p> : null}
        </Section>

        <Section title={t("settings.model")}>
          {s.modelsFailed ? <p className="px-1 text-[11px] leading-snug text-[#b54708]">{t("settings.model.failed")}</p> : null}
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
          <label className="block space-y-1">
            <span className="px-1 text-[12px] font-medium text-[#344054]">{t("settings.cap")}</span>
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
          </label>
        </Section>

        <Section>
          <Toggle
            testId="assistant-privacy"
            checked={s.settings.privacyOnly}
            onChange={(checked) => s.updateSettings({ privacyOnly: checked })}
            label={t("settings.privacy")}
            note={t("settings.privacy.note")}
          />
          <Toggle
            testId="assistant-web-search"
            checked={s.settings.webSearch}
            onChange={(checked) => s.updateSettings({ webSearch: checked })}
            label={t("settings.web")}
            note={t("settings.web.note")}
          />
        </Section>

        <ShellSection />

        <Section title={t("settings.history")}>
          <p className="px-1 text-[11px] leading-snug text-[#667085]">{t("settings.history.note")}</p>
          {confirmClear ? (
            <div className="flex gap-2">
              <button
                type="button"
                className={`${buttonClass} !border-[#b42318] !text-[#b42318]`}
                data-testid="assistant-clear-history-confirm"
                onClick={() => {
                  setConfirmClear(false);
                  void s.clearHistory();
                }}
              >
                {t("settings.history.confirm")}
              </button>
              <button type="button" className={buttonClass} onClick={() => setConfirmClear(false)}>
                {t("settings.history.cancel")}
              </button>
            </div>
          ) : (
            <button type="button" className={buttonClass} data-testid="assistant-clear-history" onClick={() => setConfirmClear(true)}>
              {t("settings.history.clear")}
            </button>
          )}
        </Section>
      </div>
    </div>
  );
}

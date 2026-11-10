"use client";

import { useEffect, useMemo, useState } from "react";
import {
  intelligenceLevel,
  latestModels,
  priceLevel,
  t,
  type ModelInfo,
  type SuggestedModel,
  type Tier
} from "@mdword/agent";
import { ArrowLeft, Check, ChevronDown, Info, Search } from "lucide-react";
import { getHost } from "@/lib/host";
import { shellModeOf, useAssistant } from "@/lib/assistant/store";
import { useApp } from "@/lib/store";
import type { ShellMode } from "@mdword/shared";

const CAPS: (number | null)[] = [1, 3, 5, 10, 25, null];
const TIERS: Tier[] = ["low", "balanced", "quality"];

/** Info icon that shows a short description on hover or keyboard focus. */
function InfoTip({ text }: { text: string }) {
  return (
    <span className="group inline-flex align-middle">
      <span
        role="img"
        tabIndex={0}
        aria-label={text}
        className="inline-flex cursor-help rounded-full text-[#98a2b3] hover:text-[#475467] focus-visible:text-[#475467] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <Info size={13} aria-hidden />
      </span>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute inset-x-1 top-full z-30 mt-1 rounded-lg bg-[#1c1f24] px-2.5 py-2 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-white opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

function Section({ title, tip, children }: { title?: string; tip?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      {title ? (
        <h3 className="relative flex items-center justify-between px-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
          {title}
          {tip ? <InfoTip text={tip} /> : null}
        </h3>
      ) : null}
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
    <label className="relative flex cursor-pointer items-start gap-3 rounded-lg px-1 py-1 hover:bg-[#f9fafb]">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[12px] font-medium text-[#1c1f24]">
          {label}
          <InfoTip text={note} />
        </span>
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

function shortPrice(info: ModelInfo | undefined): string {
  if (!info) return "";
  const p = (v: number) => {
    const n = v * 1_000_000;
    return Number.isInteger(Math.round(n * 100) / 100) && Math.round(n * 100) % 100 === 0 ? String(Math.round(n)) : n.toFixed(2);
  };
  if (info.promptPrice === 0 && info.completionPrice === 0) return "free";
  return `$${p(info.promptPrice)} / $${p(info.completionPrice)}`;
}

/** Five small bars; `level` of them are filled. A missing level shows empty, faint bars. */
function Meter({
  level,
  tone,
  label,
  estimated = false
}: {
  level: number | null;
  tone: "brain" | "cost";
  label: string;
  estimated?: boolean;
}) {
  const on = tone === "brain" ? "bg-accent" : "bg-[#f79009]";
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-end gap-px ${estimated ? "opacity-60" : ""}`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`w-[3px] rounded-[1px] ${level != null && i <= level ? on : level == null ? "bg-[#f2f4f7]" : "bg-[#e4e7ec]"}`}
          style={{ height: 3 + i * 2 }}
        />
      ))}
    </span>
  );
}

function ModelScores({ info }: { info: ModelInfo | undefined }) {
  if (!info) return null;
  const brain = intelligenceLevel(info);
  const cost = priceLevel(info);
  const brainLabel =
    brain == null
      ? t("settings.model.noScore")
      : info.intelligenceEstimated
        ? t("settings.model.estimated", { value: info.intelligence!.toFixed(0) })
        : `${t("settings.model.intelligence")}: ${info.intelligence!.toFixed(1)}`;
  const costLabel = `${t("settings.model.cost")}: ${shortPrice(info)}`;
  return (
    <span className="flex shrink-0 items-center gap-2.5">
      <Meter level={brain} tone="brain" label={brainLabel} estimated={info.intelligenceEstimated} />
      <Meter level={cost} tone="cost" label={costLabel} />
    </span>
  );
}

function ModelPicker({
  current,
  models,
  suggested,
  others,
  onSelect
}: {
  current: string;
  models: ModelInfo[] | null;
  suggested: SuggestedModel[];
  others: ModelInfo[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const byId = useMemo(() => new Map((models ?? []).map((m) => [m.id, m])), [models]);
  const needle = query.trim().toLowerCase();
  const matches = (id: string, name?: string) =>
    !needle || id.toLowerCase().includes(needle) || (name ?? "").toLowerCase().includes(needle);
  const nameOf = (id: string) => byId.get(id)?.name?.replace(/^[^:]+:\s*/, "") ?? id;
  const currentTier = suggested.find((m) => m.id === current)?.tier;
  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const choose = (id: string) => {
    onSelect(id);
    close();
  };
  const row = (id: string, tier?: Tier, reason?: string) => {
    const selected = id === current;
    return (
      <button
        key={id}
        type="button"
        role="option"
        aria-selected={selected}
        title={reason ? `${id}\n${reason}` : id}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] ${
          selected ? "bg-[#eef4ff] text-[#1c1f24]" : "text-[#344054] hover:bg-[#f2f4f7]"
        }`}
        onClick={() => choose(id)}
      >
        <Check size={12} className={selected ? "shrink-0 text-accent" : "invisible shrink-0"} />
        <span className="min-w-0 flex-1 truncate">{nameOf(id)}</span>
        <ModelScores info={byId.get(id)} />
      </button>
    );
  };
  const heading = (label: string) => (
    <div className="px-2 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-[#98a2b3]">{label}</div>
  );
  const othersShown = others.filter((m) => matches(m.id, m.name));
  const anyShown = suggested.some((m) => matches(m.id, byId.get(m.id)?.name)) || othersShown.length > 0;

  return (
    <div
      className="rounded-lg border border-[#d0d5dd] bg-white"
      data-testid="assistant-model"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          close();
        }
      }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-medium text-[#1c1f24]">{nameOf(current)}</span>
          <span className="block truncate text-[10px] text-[#667085]">
            {[currentTier ? t(`settings.tier.${currentTier}` as const) : null, shortPrice(byId.get(current))]
              .filter(Boolean)
              .join(" · ") || current}
          </span>
        </span>
        <ChevronDown size={14} className={`shrink-0 text-[#667085] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="border-t border-[#e4e7ec] p-1.5">
          <div className="relative">
            <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#98a2b3]" />
            <input
              autoFocus
              type="search"
              aria-label={t("settings.model.search")}
              placeholder={t("settings.model.search")}
              className="w-full rounded-md bg-[#f2f4f7] py-1.5 pl-6 pr-2 text-[12px] text-[#1c1f24] placeholder:text-[#98a2b3] focus:outline-none focus:ring-1 focus:ring-accent"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-end gap-3 px-2 text-[10px] text-[#98a2b3]">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {t("settings.model.intelligence")}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#f79009]" />
              {t("settings.model.cost")}
            </span>
            <InfoTip text={t("settings.model.scoreNote")} />
          </div>
          <div role="listbox" aria-label={t("settings.model")} className="mt-0.5 max-h-60 overflow-auto">
            {TIERS.map((tier) => {
              const rows = suggested.filter((m) => m.tier === tier && matches(m.id, byId.get(m.id)?.name));
              return rows.length ? (
                <div key={tier}>
                  {heading(t(`settings.tier.${tier}` as const))}
                  {rows.map((m) => row(m.id, tier, m.reason))}
                </div>
              ) : null;
            })}
            {othersShown.length ? (
              <div>
                {heading(t("settings.model.all"))}
                {othersShown.map((m) => row(m.id))}
              </div>
            ) : null}
            {!anyShown ? <p className="px-2 py-3 text-[11px] text-[#667085]">{t("settings.model.empty")}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
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
    <Section title={t("settings.shell")} tip={t("settings.shell.note")}>
      <div role="radiogroup" aria-label={t("settings.shell")} className="space-y-1.5" data-testid="assistant-shell-modes">
        {SHELL_CHOICES.map((choice) => {
          const selected = mode === choice;
          return (
            <label
              key={choice}
              className={`relative flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-[12px] ${
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
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 font-medium text-[#1c1f24]">
                  {t(`settings.shell.${choice}`)}
                  <InfoTip text={t(`settings.shellNote.${choice}`)} />
                </span>
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
  const zdrOnly = s.settings.zdrOnly;
  useEffect(() => {
    if (hasKey && !haveModels && !modelsFailed) void loadModels();
  }, [hasKey, haveModels, modelsFailed, zdrOnly, loadModels]);

  const suggestedIds = useMemo(() => new Set(s.usableSuggested.map((m) => m.id)), [s.usableSuggested]);
  const current = s.settings.modelId;
  const others = useMemo(
    () =>
      latestModels(s.models ?? [], new Set([current]))
        .filter((m) => m.supportsTools && !m.expired && !suggestedIds.has(m.id))
        .sort((a, b) => a.id.localeCompare(b.id)),
    [s.models, suggestedIds, current]
  );

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

        <Section title={t("settings.account")} tip={s.key?.hasKey ? t("settings.key.note") : undefined}>
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
        </Section>

        <Section title={t("settings.model")}>
          {s.modelsFailed ? <p className="px-1 text-[11px] leading-snug text-[#b54708]">{t("settings.model.failed")}</p> : null}
          <ModelPicker
            current={current}
            models={s.models}
            suggested={s.usableSuggested}
            others={others}
            onSelect={(modelId) => s.updateSettings({ modelId })}
          />
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
            testId="assistant-zdr"
            checked={s.settings.zdrOnly}
            onChange={(checked) => s.updateSettings({ zdrOnly: checked })}
            label={t("settings.zdr")}
            note={t("settings.zdr.note")}
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

        <Section title={t("settings.history")} tip={t("settings.history.note")}>
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

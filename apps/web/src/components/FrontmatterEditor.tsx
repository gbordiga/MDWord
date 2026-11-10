"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  addFrontmatterKey,
  frontmatterLabel,
  frontmatterValueKind,
  formatFrontmatterList,
  formatFrontmatterScalar,
  isDocumentPropertyKey,
  isFrontmatterKey,
  listCustomFrontmatterKeys,
  parseFrontmatterList,
  parseFrontmatterObject,
  removeFrontmatterKey,
  renameFrontmatterKey,
  setFrontmatterValues,
  SUGGESTED_FRONTMATTER_KEYS,
  type FrontmatterValueKind
} from "@mdword/document-model";
import { documentDate } from "@mdword/shared";
import { useApp } from "@/lib/store";

import { InfoHint, fieldClass, labelClass } from "./propertyUi";

const keyClass =
  "w-full rounded-md border border-transparent bg-transparent px-1 py-1 font-mono text-[12px] font-medium text-[#344054] outline-none hover:border-[#d0d5dd] focus:border-accent";

function commitModel(
  next: ReturnType<typeof setFrontmatterValues>
) {
  useApp.getState().replaceFrontmatterModel(next);
}

function isDayKey(key: string): boolean {
  return key === "date" || key === "data";
}

function FieldValue({
  fieldKey,
  value,
  testIdScope
}: {
  fieldKey: string;
  value: unknown;
  testIdScope: "panel" | "inline";
}) {
  const kind = frontmatterValueKind(value);
  const [jsonError, setJsonError] = useState<string | null>(null);

  if (kind === "boolean") {
    return (
      <label className="flex min-h-9 items-center gap-2 text-[13px] text-[#1c1f24]">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) =>
            commitModel(setFrontmatterValues(useApp.getState().model, { [fieldKey]: event.target.checked }, useApp.getState().workspace?.workspaceMdoc))
          }
        />
        {value ? "Yes" : "No"}
      </label>
    );
  }

  if (kind === "list") {
    return (
      <textarea
        data-testid={testIdScope === "inline" ? `fm-list-${fieldKey}` : undefined}
        className={`${fieldClass} min-h-[72px] resize-y font-sans`}
        value={formatFrontmatterList(value)}
        placeholder="One item per line"
        onChange={(event) =>
          commitModel(
            setFrontmatterValues(
              useApp.getState().model,
              { [fieldKey]: parseFrontmatterList(event.target.value) },
              useApp.getState().workspace?.workspaceMdoc
            )
          )
        }
      />
    );
  }

  if (kind === "object") {
    return (
      <div>
        <textarea
          data-testid={testIdScope === "inline" ? `fm-object-${fieldKey}` : undefined}
          className={`${fieldClass} min-h-[88px] resize-y font-mono text-[12px]`}
          defaultValue={JSON.stringify(value, null, 2)}
          onBlur={(event) => {
            const parsed = parseFrontmatterObject(event.target.value);
            if (!parsed.ok) {
              setJsonError(parsed.error);
              return;
            }
            setJsonError(null);
            commitModel(
              setFrontmatterValues(
                useApp.getState().model,
                { [fieldKey]: parsed.value },
                useApp.getState().workspace?.workspaceMdoc
              )
            );
          }}
        />
        {jsonError ? <p className="mt-1 text-[11px] text-[#b42318]">{jsonError}</p> : null}
      </div>
    );
  }

  if (kind === "number") {
    return (
      <input
        type="number"
        className={fieldClass}
        value={typeof value === "number" ? value : 0}
        onChange={(event) =>
          commitModel(
            setFrontmatterValues(
              useApp.getState().model,
              { [fieldKey]: event.target.value === "" ? 0 : Number(event.target.value) },
              useApp.getState().workspace?.workspaceMdoc
            )
          )
        }
      />
    );
  }

  const text =
    isDayKey(fieldKey) && (kind === "string" || kind === "empty")
      ? documentDate({ [fieldKey]: value }) || formatFrontmatterScalar(value)
      : formatFrontmatterScalar(value);

  return (
    <input
      data-testid={
        testIdScope === "panel" && (fieldKey === "title" || fieldKey === "titolo")
          ? "prop-title"
          : testIdScope === "panel" && isDayKey(fieldKey)
            ? "prop-date"
            : testIdScope === "inline"
              ? `fm-value-${fieldKey}`
              : undefined
      }
      type={isDayKey(fieldKey) && /^\d{4}-\d{2}-\d{2}$/.test(text) ? "date" : "text"}
      className={fieldClass}
      value={text}
      onChange={(event) =>
        commitModel(
          setFrontmatterValues(
            useApp.getState().model,
            { [fieldKey]: event.target.value === "" ? null : event.target.value },
            useApp.getState().workspace?.workspaceMdoc
          )
        )
      }
    />
  );
}

export function FrontmatterEditor({
  compact,
  testIdScope = "inline"
}: {
  compact?: boolean;
  testIdScope?: "panel" | "inline";
}) {
  const model = useApp((s) => s.model);
  const keys = listCustomFrontmatterKeys(model);
  const [draftKey, setDraftKey] = useState("");
  const [draftKind, setDraftKind] = useState<FrontmatterValueKind>("string");
  const suggestions = useMemo(
    () => SUGGESTED_FRONTMATTER_KEYS.filter((key) => !keys.includes(key)),
    [keys]
  );

  const add = (key: string, kind: FrontmatterValueKind = "string") => {
    const next = key.trim();
    if (!isFrontmatterKey(next) || isDocumentPropertyKey(next)) return;
    commitModel(addFrontmatterKey(useApp.getState().model, next, kind, useApp.getState().workspace?.workspaceMdoc));
    setDraftKey("");
  };

  return (
    <div className="space-y-2" data-testid={testIdScope === "inline" ? "frontmatter-editor" : "properties-fields"}>
      {keys.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#d0d5dd] px-3 py-2.5 text-center text-[12px] text-[#667085]">No custom properties yet</p>
      ) : (
        <ul className="space-y-2">
          {keys.map((key) => (
            <li
              key={key}
              className={compact ? "grid grid-cols-1 gap-1" : "grid grid-cols-[minmax(7rem,11rem)_1fr_auto] items-start gap-2"}
              data-testid={testIdScope === "inline" ? `fm-row-${key}` : undefined}
            >
              <div>
                <input
                  aria-label={`Rename ${key}`}
                  className={keyClass}
                  defaultValue={key}
                  onBlur={(event) => {
                    const next = event.target.value.trim();
                    if (!next || next === key) {
                      event.target.value = key;
                      return;
                    }
                    if (!isFrontmatterKey(next) || Object.prototype.hasOwnProperty.call(useApp.getState().model.frontmatter, next)) {
                      event.target.value = key;
                      return;
                    }
                    commitModel(
                      renameFrontmatterKey(
                        useApp.getState().model,
                        key,
                        next,
                        useApp.getState().workspace?.workspaceMdoc
                      )
                    );
                  }}
                />
                <p className="px-1 text-[11px] text-[#98a2b3]">{frontmatterLabel(key)}</p>
              </div>
              <FieldValue fieldKey={key} value={model.frontmatter[key]} testIdScope={testIdScope} />
              <button
                type="button"
                className="mt-0.5 rounded-md p-1.5 text-[#98a2b3] hover:bg-[#f2f4f7] hover:text-[#b42318]"
                title={`Remove ${key}`}
                aria-label={`Remove ${key}`}
                onClick={() =>
                  commitModel(
                    removeFrontmatterKey(useApp.getState().model, key, useApp.getState().workspace?.workspaceMdoc)
                  )
                }
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2 border-t border-[#eaecf0] pt-3">
        <label className={`${labelClass} min-w-[8rem] flex-1`}>
          <span className="mb-1 flex items-center gap-1">New property<InfoHint text="Stored with this document. Pick a suggested name or type your own." /></span>
          <input
            data-testid={testIdScope === "inline" ? "fm-new-key" : undefined}
            list={`fm-suggested-keys-${testIdScope}`}
            className={fieldClass}
            placeholder="custom_key"
            value={draftKey}
            onChange={(event) => setDraftKey(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add(draftKey, draftKind);
              }
            }}
          />
        </label>
        <datalist id={`fm-suggested-keys-${testIdScope}`}>
          {suggestions.map((key) => (
            <option key={key} value={key} />
          ))}
        </datalist>
        <label className={labelClass}>
          <span className="mb-1 block">Type</span>
          <select
            className={`${fieldClass} w-[7.5rem]`}
            value={draftKind}
            onChange={(event) => setDraftKind(event.target.value as FrontmatterValueKind)}
          >
            <option value="string">Text</option>
            <option value="list">List</option>
            <option value="number">Number</option>
            <option value="boolean">Yes / No</option>
          </select>
        </label>
        <button
          type="button"
          data-testid={testIdScope === "inline" ? "fm-add" : undefined}
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-accent px-3 text-[12px] font-medium text-white hover:opacity-90 disabled:bg-[#d0d5dd] max-lg:h-10"
          onClick={() => add(draftKey, draftKind)}
          disabled={!isFrontmatterKey(draftKey.trim()) || isDocumentPropertyKey(draftKey.trim())}
        >
          <Plus size={14} />
          Add
        </button>
      </div>
    </div>
  );
}

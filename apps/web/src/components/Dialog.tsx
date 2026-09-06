"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function Dialog({
  open,
  title,
  onClose,
  testId,
  children,
  footer
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  testId: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const root = panelRef.current;
    const focusable = root?.querySelector<HTMLElement>("input, textarea, select, button");
    focusable?.focus();
    if (focusable instanceof HTMLInputElement || focusable instanceof HTMLTextAreaElement) {
      const len = focusable.value.length;
      focusable.setSelectionRange(len, len);
    }
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${testId}-title`}
        data-testid={testId}
        className="relative z-10 flex max-h-[min(90dvh,var(--app-height,100dvh))] w-full flex-col rounded-t-2xl bg-white shadow-[0_16px_48px_rgb(16_24_40_/_24%)] sm:max-w-md sm:rounded-xl"
      >
        <header className="flex items-center justify-between gap-2 border-b border-[#e4e7ec] px-3 py-1">
          <h2 id={`${testId}-title`} className="px-1 text-[16px] font-semibold text-[#1c1f24]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[#344054] hover:bg-[#f2f4f7]"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">{children}</div>
        {footer ? (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-[#e4e7ec] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

export function DialogField({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="mb-3 block text-[13px] font-medium text-[#344054]">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export const dialogInputClass =
  "w-full rounded-md border border-[#e4e7ec] px-3 py-2 text-[16px] outline-none focus:border-accent lg:text-[13px]";

export function DialogButton({
  children,
  onClick,
  variant = "secondary",
  disabled,
  testId,
  type = "button"
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  testId?: string;
  type?: "button" | "submit";
}) {
  const styles =
    variant === "primary"
      ? "bg-accent text-white hover:bg-[#1e40af]"
      : variant === "danger"
        ? "text-[#b42318] hover:bg-[#fef3f2]"
        : "text-[#344054] hover:bg-[#f2f4f7]";
  return (
    <button
      type={type}
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3 text-[14px] font-medium touch-manipulation disabled:cursor-not-allowed disabled:opacity-40 ${styles}`}
    >
      {children}
    </button>
  );
}

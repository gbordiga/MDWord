import type { UpdateStatus } from "@mdword/shared";

export type UpdateNotice = {
  tone: "progress" | "ready" | "error";
  text: string;
  /** Shows an action button next to the message. */
  action?: "restart" | "retry";
};

/**
 * What the update banner should say. Silent states (startup checks, development
 * builds) return null so they never interrupt writing.
 */
export function updateNotice(status: UpdateStatus | null): UpdateNotice | null {
  if (!status) return null;
  switch (status.state) {
    case "idle":
    case "checking":
    case "unsupported":
      return null;
    case "available":
      return { tone: "progress", text: `Downloading MDWord ${status.version}…` };
    case "downloading":
      return {
        tone: "progress",
        text: `Downloading MDWord ${status.version}… ${status.percent}%`
      };
    case "downloaded":
      return {
        tone: "ready",
        text: `MDWord ${status.version} is ready to install.`,
        action: "restart"
      };
    case "none":
      return { tone: "progress", text: "MDWord is up to date." };
    case "error":
      return { tone: "error", text: status.message, action: "retry" };
  }
}

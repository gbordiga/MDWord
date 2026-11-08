import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { messagesEn } from "@mdword/agent";

const roots = [
  path.resolve(__dirname, "../../components/assistant"),
  path.resolve(__dirname)
];

function sources(): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  for (const dir of roots) {
    for (const name of readdirSync(dir)) {
      if (!/\.(ts|tsx)$/.test(name) || name.includes(".test.")) continue;
      out.push({ file: path.join(dir, name), text: readFileSync(path.join(dir, name), "utf8") });
    }
  }
  return out;
}

describe("assistant localization", () => {
  it("every catalog key is used somewhere", () => {
    const code = [
      ...sources().map((s) => s.text),
      readFileSync(path.resolve(__dirname, "../../../../../packages/agent/src/loop.ts"), "utf8"),
      readFileSync(path.resolve(__dirname, "../../../../../packages/agent/src/messages.en.ts"), "utf8").split("export type MessageKey")[1] ?? ""
    ].join("\n");
    const unused = Object.keys(messagesEn).filter((key) => {
      if (code.includes(`"${key}"`)) return false;
      // Keys built from a prefix, such as settings.tier.<tier>.
      const prefix = key.replace(/\.[^.]+$/, "");
      return !code.includes(`${prefix}.\${`);
    });
    expect(unused).toEqual([]);
  });

  it("components contain no literal user-facing strings outside the catalog", () => {
    const offenders: string[] = [];
    for (const { file, text } of sources()) {
      if (!file.endsWith(".tsx")) continue;
      for (const m of text.matchAll(/\b(?:aria-label|title|placeholder|alt)="([^"{]*[A-Za-z]{3,}[^"]*)"/g)) {
        offenders.push(`${path.basename(file)}: attribute "${m[1]}"`);
      }
      for (const m of text.matchAll(/>\s*([A-Za-z][^<>{}\n]{2,})\s*</g)) {
        offenders.push(`${path.basename(file)}: text "${m[1]!.trim()}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("catalog strings are whole sentences with named parameters", () => {
    for (const [key, value] of Object.entries(messagesEn)) {
      expect(value, key).not.toMatch(/\{\d+\}/);
    }
  });
});

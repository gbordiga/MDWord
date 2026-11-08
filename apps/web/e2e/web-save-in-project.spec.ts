import { test, expect } from "@playwright/test";

// A tiny in-memory File System Access API, enough for a project folder and a save dialog.
const FAKE_FS = () => {
  class FakeFile {
    kind = "file" as const;
    constructor(public name: string, public text = "") {}
    async getFile() {
      return new File([this.text], this.name, { type: "text/markdown" });
    }
    async createWritable() {
      let buffer = "";
      return {
        write: async (data: string) => {
          buffer = String(data);
        },
        close: async () => {
          this.text = buffer;
        }
      };
    }
    async queryPermission() {
      return "granted";
    }
  }
  class FakeDir {
    kind = "directory" as const;
    children = new Map<string, FakeFile | FakeDir>();
    constructor(public name: string) {}
    async *entries() {
      for (const entry of this.children) yield entry;
    }
    async getFileHandle(name: string, opts?: { create?: boolean }) {
      let hit = this.children.get(name);
      if (!hit && opts?.create) this.children.set(name, (hit = new FakeFile(name)));
      if (!hit || hit.kind !== "file") throw new DOMException("missing", "NotFoundError");
      return hit;
    }
    async getDirectoryHandle(name: string, opts?: { create?: boolean }) {
      let hit = this.children.get(name);
      if (!hit && opts?.create) this.children.set(name, (hit = new FakeDir(name)));
      if (!hit || hit.kind !== "directory") throw new DOMException("missing", "NotFoundError");
      return hit;
    }
    async removeEntry(name: string) {
      this.children.delete(name);
    }
    async resolve(target: FakeFile) {
      for (const [name, child] of this.children) if (child === target) return [name];
      return null;
    }
    async queryPermission() {
      return "granted";
    }
    async requestPermission() {
      return "granted";
    }
  }
  const root = new FakeDir("proj");
  root.children.set("a.md", new FakeFile("a.md", "# A\n"));
  const w = window as unknown as Record<string, unknown>;
  w.__FAKE_ROOT__ = root;
  w.showDirectoryPicker = async () => root;
  w.showSaveFilePicker = async (opts: { suggestedName?: string }) => {
    const name = opts.suggestedName ?? "document.md";
    return root.getFileHandle(name, { create: true });
  };
};

test("saving a new document with a project open writes into the project folder", async ({ page }) => {
  await page.addInitScript(FAKE_FS);
  const downloads: string[] = [];
  page.on("download", (d) => downloads.push(d.suggestedFilename()));

  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => window.__MDWORD_APP__!.getState().openFolder());
  await expect.poll(() => page.evaluate(() => window.__MDWORD_APP__!.getState().workspace?.root ?? null)).toBe("proj");

  await page.locator(".ProseMirror").click();
  await page.keyboard.type("Saved into the project");
  await page.evaluate(() => window.__MDWORD_APP__!.getState().saveFile());

  await expect
    .poll(() =>
      page.evaluate(() => {
        const root = (window as unknown as { __FAKE_ROOT__: { children: Map<string, { text?: string }> } }).__FAKE_ROOT__;
        return root.children.get("document.md")?.text ?? null;
      })
    )
    .toContain("Saved into the project");
  expect(downloads).toEqual([]);
  expect(await page.evaluate(() => window.__MDWORD_APP__!.getState().path)).toBe("proj/document.md");
  await expect
    .poll(() => page.evaluate(() => window.__MDWORD_APP__!.getState().workspace?.files.some((f) => f.name === "document.md")))
    .toBe(true);
});

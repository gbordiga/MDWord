import { test, expect, type Page } from "@playwright/test";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const DOC = `# Photos

![cat](./cat.png)

![gone](./missing.png)
`;

async function openImportImages(page: Page) {
  await page.evaluate(() => window.__MDWORD_APP__!.getState().setRibbon("references"));
  const button = page.getByTestId("import-images");
  await expect(button).toBeVisible();
  await button.click();
}

async function seedPhotoDoc(page: Page) {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  await page.evaluate(
    ({ doc, png }) => {
      const store = window.__MDWORD_APP__;
      if (!store) throw new Error("App store is not available");
      if (!window.__MDWORD_PRIME_FILE__) throw new Error("File priming hook is not available");
      window.__MDWORD_PRIME_FILE__("/notes/photos.md", doc);
      window.__MDWORD_PRIME_FILE__("/notes/cat.png", png);
      store.setState({
        workspace: {
          root: "/notes",
          files: [
            { path: "/notes/photos.md", name: "photos.md", isDirectory: false },
            { path: "/notes/cat.png", name: "cat.png", isDirectory: false }
          ],
          index: { documents: [] },
          workspaceMdoc: undefined
        }
      });
    },
    { doc: DOC, png: PNG }
  );
  await page.evaluate(() => window.__MDWORD_APP__!.getState().openWorkspaceFile("/notes/photos.md"));
  await expect(page.locator(".ProseMirror")).toContainText("Photos");
  await expect(page.locator('[data-testid="doc-figure"]').first()).toBeVisible();
}

test("References import embeds file-backed images and can undo", async ({ page }) => {
  await seedPhotoDoc(page);
  await openImportImages(page);
  const dialog = page.getByTestId("import-images-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Imported 1 image");
  await expect(dialog).toContainText("missing.png");
  await dialog.getByTestId("import-images-keep").click();
  await expect(dialog).toHaveCount(0);

  await expect(page.locator('[data-testid="doc-image"]').first()).toHaveAttribute("src", /^(blob:|data:image\/)/);

  const embedded = await page.evaluate(() => {
    window.__MDWORD_APP__!.getState().flushPendingEdits();
    return window.__MDWORD_APP__!.getState().model.source;
  });
  expect(embedded).toContain("data:image/");
  expect(embedded).not.toContain("./cat.png");
  expect(embedded).toContain("./missing.png");

  await page.locator(".ProseMirror").click();
  await page.keyboard.press("ControlOrMeta+Z");
  await expect(page.locator('[data-testid="doc-image"]').first()).toHaveAttribute("src", /cat\.png/);
  const undone = await page.evaluate(() => {
    window.__MDWORD_APP__!.getState().flushPendingEdits();
    return window.__MDWORD_APP__!.getState().model.source;
  });
  expect(undone).toContain("./cat.png");
});

test("already embedded images are left alone", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  await page.evaluate(async (source) => {
    await window.__MDWORD_APP__!.getState().restoreHistory(`![dot](${source})\n`);
  }, PNG);
  await expect(page.locator('[data-testid="doc-figure"]')).toBeVisible();
  await expect(page.getByTestId("ribbon-tab-image")).toBeEnabled();
  await openImportImages(page);
  const dialog = page.getByTestId("import-images-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("already inlined");
  await dialog.getByTestId("import-images-ok").click();
});

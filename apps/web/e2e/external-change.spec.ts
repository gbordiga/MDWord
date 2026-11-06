import { test, expect, type Page } from "@playwright/test";

const OPENED = "---\ntitle: External\n---\n\n# Opened on disk\n";
const EXTERNAL = "---\ntitle: External\n---\n\n# Edited elsewhere\n";

async function openPrimedFile(page: Page) {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await page.evaluate((source) => {
    if (!window.__MDWORD_PRIME_FILE__) throw new Error("File priming hook is not available");
    window.__MDWORD_PRIME_FILE__("/notes/external.md", source);
  }, OPENED);
  await page.evaluate(() => window.__MDWORD_APP__!.getState().openWorkspaceFile("/notes/external.md"));
  await expect(prose).toContainText("Opened on disk");
  return prose;
}

async function typeLocally(page: Page, prose: ReturnType<Page["locator"]>) {
  await prose.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" local edit");
  await expect.poll(() => page.evaluate(() => window.__MDWORD_APP__!.getState().dirty)).toBe(true);
}

async function simulateExternalEdit(page: Page) {
  await page.evaluate((source) => {
    window.__MDWORD_PRIME_FILE__!("/notes/external.md", source);
  }, EXTERNAL);
}

test("a save is blocked when the file changed on disk, and reload adopts the disk version", async ({
  page
}) => {
  const prose = await openPrimedFile(page);
  await simulateExternalEdit(page);
  await typeLocally(page, prose);

  await page.keyboard.press("ControlOrMeta+S");
  const dialog = page.getByTestId("external-change-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("changed on disk");

  await dialog.getByTestId("external-reload").click();
  await expect(dialog).toHaveCount(0);
  await expect(prose).toContainText("Edited elsewhere");
  await expect(prose).not.toContainText("local edit");
  await expect.poll(() => page.evaluate(() => window.__MDWORD_APP__!.getState().dirty)).toBe(false);
});

test("cancelling the prompt keeps the local edit unsaved", async ({ page }) => {
  const prose = await openPrimedFile(page);
  await simulateExternalEdit(page);
  await typeLocally(page, prose);

  await page.keyboard.press("ControlOrMeta+S");
  const dialog = page.getByTestId("external-change-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);

  await expect(prose).toContainText("local edit");
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-save-state", "unsaved");
});

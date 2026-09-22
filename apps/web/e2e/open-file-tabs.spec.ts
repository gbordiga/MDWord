import { test, expect } from "@playwright/test";

test("opening a file replaces the pristine Untitled tab", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-testid="document-tab"]:visible')).toHaveCount(1);
  await page.evaluate(() => {
    if (!window.__MDWORD_PRIME_FILE__) throw new Error("File priming hook is not available");
    window.__MDWORD_PRIME_FILE__("/notes/only.md", "# Only file\n");
  });
  await page.evaluate(() => window.__MDWORD_APP__!.getState().openWorkspaceFile("/notes/only.md"));
  const tabs = page.locator('[data-testid="document-tab"]:visible');
  await expect(tabs).toHaveCount(1);
  await expect(tabs).toContainText("only");
  await expect(tabs).not.toContainText("Untitled");
});

test("a dirty Untitled document stays open beside the file you open", async ({ page }) => {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await prose.click();
  await page.keyboard.type("Keep this draft");
  await expect.poll(() => page.evaluate(() => window.__MDWORD_APP__!.getState().dirty)).toBe(true);
  await page.evaluate(() => {
    if (!window.__MDWORD_PRIME_FILE__) throw new Error("File priming hook is not available");
    window.__MDWORD_PRIME_FILE__("/notes/only.md", "# Only file\n");
  });
  await page.evaluate(() => window.__MDWORD_APP__!.getState().openWorkspaceFile("/notes/only.md"));
  const tabs = page.locator('[data-testid="document-tab"]:visible');
  await expect(tabs).toHaveCount(2);
  await expect(tabs.filter({ hasText: "Untitled" })).toHaveCount(1);
  await expect(tabs.filter({ hasText: "only" })).toHaveCount(1);
});

test("closing the page is blocked while any document is dirty", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  const clean = await page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(clean).toBe(false);

  const blocked = await page.evaluate(() => {
    const store = window.__MDWORD_APP__;
    if (!store) throw new Error("App store is not available");
    const state = store.getState();
    store.setState({
      dirty: false,
      tabs: [
        ...state.tabs,
        {
          ...state.tabs[0]!,
          id: "background",
          path: "/notes/background.md",
          dirty: true
        }
      ]
    });
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(blocked).toBe(true);
});

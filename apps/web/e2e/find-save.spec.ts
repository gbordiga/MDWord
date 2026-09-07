import { test, expect } from "@playwright/test";

test("Ctrl+F from the document starts live find without leaving the field", async ({ page }) => {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await prose.click();
  await page.keyboard.type("Alpha unique token and more Alpha");
  await page.keyboard.press("ControlOrMeta+F");
  await expect(page.getByTestId("find-bar")).toBeVisible();
  const findInput = page.getByTestId("find-input");
  await expect(findInput).toBeFocused();
  await findInput.fill("Alpha");
  await expect(page.getByTestId("find-status")).toContainText("1 of 2");
  await expect(findInput).toBeFocused();
});

test("Home ribbon Find opens in-document search", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Home" }).click();
  await page.getByTestId("open-find-home").click();
  await expect(page.getByTestId("find-bar")).toBeVisible();
  await expect(page.getByTestId("find-input")).toBeFocused();
});

test("find locates text in source view", async ({ page }) => {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await prose.click();
  await page.keyboard.type("SourceFindNeedle");
  await page.getByRole("button", { name: "View" }).click();
  await page.getByTitle("Source").click();
  await expect(page.getByTestId("source-editor")).toBeVisible();
  await expect(page.locator(".cm-content")).toContainText("SourceFindNeedle");
  await page.keyboard.press("ControlOrMeta+F");
  await expect(page.getByTestId("find-bar")).toBeVisible();
  await page.getByTestId("find-input").fill("SourceFindNeedle");
  await expect(page.getByTestId("find-status")).toContainText("1 of 1");
});

test("PDF export writes title and date into the print document", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("prop-title").fill("Audit report");
  const dateField = page.getByTestId("prop-date");
  await dateField.click();
  await dateField.fill("");
  await dateField.pressSequentially("2026-03-15", { delay: 30 });
  await expect(dateField).toHaveValue("2026-03-15");
  await expect(page.getByTestId("doc-title")).toContainText("Audit report");
  await expect(page.getByTestId("doc-date")).toContainText("2026-03-15");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByTitle("Export PDF").click();
  await page.waitForFunction(
    () => Boolean((window as Window & { __MDWORD_LAST_EXPORT_HTML__?: string }).__MDWORD_LAST_EXPORT_HTML__)
  );
  const html = await page.evaluate(
    () => (window as Window & { __MDWORD_LAST_EXPORT_HTML__?: string }).__MDWORD_LAST_EXPORT_HTML__ ?? ""
  );
  expect(html).toContain('class="doc-title"');
  expect(html).toContain("Audit report");
  expect(html).toContain('class="doc-date"');
  expect(html).toContain("2026-03-15");
  expect(html).not.toContain("print-running-header");
  expect(html).not.toContain("print-root");
  expect(html).toMatch(/@top-left/);
  expect(html).toMatch(/@top-right/);
  expect(html).toMatch(/@bottom-right/);
  expect(html).toMatch(/counter\(page\)/);
  expect(html).not.toContain("print-page");
  expect(html).not.toMatch(/position:\s*fixed/);
  expect(html).toContain("paged.polyfill.min.js");
});

test("typing a draft stays unsaved until a manual save", async ({ page }) => {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await prose.click();
  await page.keyboard.type("Manual save draft token");
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-save-state", "unsaved");
  await expect(page.getByTestId("save-status")).toContainText("Unsaved");
  await page.waitForTimeout(2000);
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-save-state", "unsaved");
  await expect(page.getByTestId("topbar-sidebar")).toBeVisible();
  await expect(page.getByTestId("topbar-properties")).toBeVisible();
  await page.getByRole("button", { name: "history", exact: true }).click();
  await expect(page.getByTestId("history-pane")).toBeVisible();
  await expect(page.getByTestId("history-unsaved")).toBeEnabled();
  await expect(page.getByTestId("history-diff")).toContainText("Manual save draft token");
});

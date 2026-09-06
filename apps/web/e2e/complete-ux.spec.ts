import { test, expect } from "@playwright/test";

test("find bar locates typed text", async ({ page }) => {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await prose.click();
  await page.keyboard.type("Alpha unique token and more Alpha");
  await page.keyboard.press("ControlOrMeta+F");
  await expect(page.getByTestId("find-bar")).toBeVisible();
  await page.getByTestId("find-input").fill("Alpha");
  await page.getByTestId("find-next").click();
  await expect(page.getByTestId("find-status")).toContainText("of 2");
  const selected = await page.evaluate(() => window.getSelection()?.toString());
  expect(selected).toBe("Alpha");
});

test("outline jumps to a heading", async ({ page }) => {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await prose.click();
  await page.keyboard.type("Jump here");
  await page.getByRole("button", { name: "Home" }).click();
  await page.getByTestId("ribbon-style").selectOption("1");
  await page.getByRole("button", { name: "View" }).click();
  await page.getByTitle("Outline").click();
  await expect(page.getByTestId("outline-item").filter({ hasText: "Jump here" })).toBeVisible();
  await page.getByTestId("outline-item").filter({ hasText: "Jump here" }).click();
  await expect(prose.locator("h1")).toContainText("Jump here");
});

test("table tools add a row and can delete the table", async ({ page }) => {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Insert" }).click();
  await page.getByTestId("insert-table").click();
  await expect(prose.locator("table")).toBeVisible();
  const rowsBefore = await prose.locator("tr").count();
  await expect(page.getByTestId("editor-context-bar")).toBeVisible();
  await page.getByTestId("table-add-row").click();
  await expect(prose.locator("tr")).toHaveCount(rowsBefore + 1);
  await page.getByTestId("table-delete").click();
  await expect(prose.locator("table")).toHaveCount(0);
});

test("callout kind can be changed after insert", async ({ page }) => {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Insert" }).click();
  await page.getByTestId("insert-callout").click();
  await expect(prose.locator("aside.callout")).toBeVisible();
  await page.getByTestId("callout-kind").selectOption("warning");
  await expect(prose.locator("aside.callout-warning")).toBeVisible();
});

test("new document asks to discard unsaved changes", async ({ page }) => {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await prose.click();
  await page.keyboard.type("Unsaved draft text");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByTitle("New").click();
  await expect(page.getByTestId("confirm-dialog")).toBeVisible();
  await page.getByTestId("confirm-discard").click();
  await expect(page.getByTestId("confirm-dialog")).toBeHidden();
  await expect(prose).not.toContainText("Unsaved draft text");
});

test("inserting a TOC writes a contents list", async ({ page }) => {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await prose.click();
  await page.keyboard.type("Chapter");
  await page.getByRole("button", { name: "Home" }).click();
  await page.getByTestId("ribbon-style").selectOption("1");
  await page.getByRole("button", { name: "References" }).click();
  await page.getByTestId("insert-toc").click();
  await expect(prose.locator("h2")).toContainText("Contents");
  await expect(prose.locator("ul")).toContainText("Chapter");
});

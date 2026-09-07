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
  await expect(page.getByTestId("find-status")).toContainText("1 of 2");
  await page.getByTestId("find-next").click();
  await expect(page.getByTestId("find-status")).toContainText("2 of 2");
  await expect(page.getByTestId("find-input")).toBeFocused();
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

test("inline properties edit standard and custom fields", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("frontmatter-inline")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("frontmatter-toggle").click();
  await expect(page.getByTestId("frontmatter-editor")).toBeVisible();
  await expect(page.getByTestId("fm-value-title")).toBeVisible();
  await page.getByTestId("fm-value-title").fill("Scheda QMS");
  await page.getByTestId("fm-new-key").fill("codice");
  await page.getByTestId("fm-add").click();
  await expect(page.getByTestId("fm-row-codice")).toBeVisible();
  await page.getByTestId("fm-value-codice").fill("IPR001");
  await expect(page.getByTestId("doc-title")).toHaveText("Scheda QMS");
  await page.getByRole("button", { name: "View" }).click();
  await page.getByTitle("Source").click();
  await expect(page.locator(".cm-content")).toContainText("codice: IPR001");
  await expect(page.locator(".cm-content")).toContainText("title: Scheda QMS");
});

test("table of contents is a live frontmatter option", async ({ page }) => {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await prose.click();
  await page.keyboard.type("Chapter");
  await page.getByRole("button", { name: "Home" }).click();
  await page.getByTestId("ribbon-style").selectOption("1");
  await page.getByRole("button", { name: "References" }).click();
  await expect(page.getByTestId("insert-toc")).toContainText("Table of contents");
  await page.getByTestId("insert-toc").click();
  const toc = page.getByTestId("document-toc");
  await expect(toc).toBeVisible();
  await expect(toc).toContainText("Contents");
  await expect(toc).toContainText("Chapter");
  await expect(prose.locator("h2")).toHaveCount(0);
});

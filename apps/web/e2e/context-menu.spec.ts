import { test, expect, type Page } from "@playwright/test";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function openEditor(page: Page) {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  const discard = page.getByTestId("recovery-discard");
  if (await discard.isVisible()) await discard.click();
  return prose;
}

test("text context menu can apply bold", async ({ page }) => {
  const prose = await openEditor(page);
  await prose.locator("h1").first().click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Hello menu");
  const typed = prose.locator("p").filter({ hasText: "Hello menu" });
  await expect(typed).toBeVisible();
  await typed.click({ clickCount: 3 });
  await typed.click({ button: "right" });
  const menu = page.getByTestId("editor-context-menu");
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute("data-kind", "text");
  await expect(page.getByTestId("editor-menu-bold")).toContainText("Ctrl+B");
  await page.getByTestId("editor-menu-bold").click();
  await expect(menu).toBeHidden();
  await expect(prose.locator("strong")).toContainText("Hello menu");
});

test("table context menu adds a row", async ({ page }) => {
  const prose = await openEditor(page);
  await page.getByRole("button", { name: "Insert" }).click();
  await page.getByTestId("insert-table").click();
  await expect(prose.locator("table")).toBeVisible();
  const rows = prose.locator("tr");
  const before = await rows.count();
  await prose.locator("td, th").first().click({ button: "right" });
  const menu = page.getByTestId("editor-context-menu");
  await expect(menu).toHaveAttribute("data-kind", "table");
  await expect(page.getByTestId("editor-menu-bold")).toBeVisible();
  await expect(page.getByTestId("editor-menu-add-row")).toBeVisible();
  await page.getByTestId("editor-menu-add-row").click();
  await expect(rows).toHaveCount(before + 1);
});

test("image context menu can delete the figure", async ({ page }) => {
  const prose = await openEditor(page);
  await page.evaluate((src) => {
    const el = document.querySelector(".ProseMirror") as { editor?: { chain: Function } } | null;
    if (!el?.editor) throw new Error("editor missing");
    el.editor.chain().focus().setFigure({ src, alt: "dot" }).run();
  }, TINY_PNG);
  const figure = prose.locator('[data-testid="doc-figure"]');
  await expect(figure).toBeVisible();
  await figure.click({ button: "right" });
  const menu = page.getByTestId("editor-context-menu");
  await expect(menu).toHaveAttribute("data-kind", "image");
  await page.getByTestId("editor-menu-del-image").click();
  await expect(figure).toHaveCount(0);
});

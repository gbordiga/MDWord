import { test, expect } from "@playwright/test";

test("loads the editor and shows an A4 page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("MDWord")).toBeVisible();
  await expect(page.getByText("Home")).toBeVisible();
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await prose.click();
  await page.keyboard.type("Hello MDWord");
  await expect(prose).toContainText("Hello MDWord");
});

test("boot splash hides after the editor is ready", async ({ page }) => {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("app-boot")).toBeHidden();
  await expect(page.getByTestId("editor-loading")).toHaveCount(0);
});

test("switches to source mode and keeps markdown", async ({ page }) => {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "View" }).click();
  await page.getByTitle("Source").click();
  await expect(page.getByTestId("source-editor")).toBeVisible();
  await expect(page.locator(".cm-editor")).toBeVisible();
});

test("applies heading 1 from the Home ribbon", async ({ page }) => {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await prose.click();
  await page.keyboard.type("Titolo");
  await page.getByRole("button", { name: "Home" }).click();
  await page.getByTestId("ribbon-style").selectOption("1");
  await expect(prose.locator("h1")).toContainText("Titolo");
  const h1Size = await prose.locator("h1").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  await page.keyboard.press("Enter");
  await page.getByTestId("ribbon-style").selectOption("p");
  await page.keyboard.type("Corpo");
  const pSize = await prose.locator("p").last().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(h1Size).toBeGreaterThan(pSize);
});

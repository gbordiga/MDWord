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

import { test, expect } from "@playwright/test";

test("Layout ribbon Narrow preset updates margin fields and the page", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  const header = page.getByTestId("page-header");
  const normalHeight = await header.evaluate((el) => (el as HTMLElement).style.height);
  await page.getByRole("button", { name: "Layout" }).click();
  await page.getByTestId("ribbon-margins").selectOption("narrow");
  await expect(page.getByTestId("prop-margin-left")).toHaveValue("12.7mm");
  await expect(page.getByTestId("prop-margin-top")).toHaveValue("12.7mm");
  await expect(page.getByTestId("margin-preset")).toHaveValue("narrow");
  await expect(header).not.toHaveCSS("height", normalHeight);
  const narrowHeight = await header.evaluate((el) => (el as HTMLElement).style.height);
  expect(parseFloat(narrowHeight)).toBeLessThan(parseFloat(normalHeight));
});

test("Properties margin preset Wide updates left and right millimetres", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("margin-preset").selectOption("wide");
  await expect(page.getByTestId("prop-margin-left")).toHaveValue("50mm");
  await expect(page.getByTestId("prop-margin-right")).toHaveValue("50mm");
  await page.getByRole("button", { name: "Layout" }).click();
  await expect(page.getByTestId("ribbon-margins")).toHaveValue("wide");
});

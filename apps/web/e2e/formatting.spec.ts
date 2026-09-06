import { test, expect, type Page } from "@playwright/test";

function fmtButton(page: Page, id: string) {
  return page.locator(`[data-testid="${id}"]`).locator("visible=true");
}

test("numbered lists, quotes and links are visible as formatted blocks", async ({ page }) => {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await expect(fmtButton(page, "fmt-ordered")).toBeVisible({ timeout: 20_000 });
  await prose.click();
  await page.keyboard.type("Uno");
  await fmtButton(page, "fmt-ordered").click();
  const ol = prose.locator("ol");
  await expect(ol).toBeVisible();
  await expect(ol.locator("li")).toContainText("Uno");
  const listStyle = await ol.evaluate((el) => getComputedStyle(el).listStyleType);
  expect(listStyle).toBe("decimal");
  const display = await ol.locator("li").evaluate((el) => getComputedStyle(el).display);
  expect(display).toContain("list-item");

  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Una citazione");
  await fmtButton(page, "fmt-quote").click();
  const quote = prose.locator("blockquote");
  await expect(quote).toBeVisible();
  await expect(quote).toContainText("Una citazione");
  const border = await quote.evaluate((el) => parseFloat(getComputedStyle(el).borderLeftWidth));
  expect(border).toBeGreaterThan(0);
  const italic = await quote.evaluate((el) => getComputedStyle(el).fontStyle);
  expect(italic).toBe("italic");

  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("https://example.com ");
  const link = prose.locator('a.md-link, a[href="https://example.com"]');
  await expect(link).toBeVisible();
  const color = await link.evaluate((el) => getComputedStyle(el).color);
  expect(color).toMatch(/rgb\(29,\s*78,\s*216\)/);
  const decoration = await link.evaluate((el) => getComputedStyle(el).textDecorationLine);
  expect(decoration).toContain("underline");
});

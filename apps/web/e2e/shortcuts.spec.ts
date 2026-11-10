import { test, expect } from "@playwright/test";

test.describe("formatting shortcuts", () => {
  test.skip(({ isMobile }) => isMobile, "keyboard shortcuts and hover tooltips are for desktop");

  test("each shortcut applies its format once", async ({ page }) => {
    await page.goto("/");
    const prose = page.locator(".ProseMirror");
    await expect(prose).toBeVisible({ timeout: 20_000 });
    await prose.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("word");
    await page.keyboard.press("Control+a");
    const cases: [string, string][] = [
      ["Control+b", "strong"],
      ["Control+i", "em"],
      ["Control+u", "u"],
      ["Control+Shift+x", "s"],
      ["Control+e", "code"]
    ];
    for (const [keys, tag] of cases) {
      await page.keyboard.press(keys);
      await expect(prose.locator(tag)).toHaveCount(1);
      await page.keyboard.press(keys);
      await expect(prose.locator(tag)).toHaveCount(0);
    }
    await page.keyboard.press("Control+Shift+8");
    await expect(prose.locator("ul")).toHaveCount(1);
    await page.keyboard.press("Control+Shift+8");
    await page.keyboard.press("Control+Shift+7");
    await expect(prose.locator("ol")).toHaveCount(1);
  });

  test("toolbar tooltips show the shortcut", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
    await page.getByLabel("Bold", { exact: true }).locator("visible=true").hover();
    const tip = page.getByTestId("tooltip");
    await expect(tip).toContainText("Bold");
    await expect(tip).toContainText("Ctrl");
    await expect(tip).toContainText("B");
  });
});

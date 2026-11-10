import { test, expect } from "@playwright/test";

test.describe("outline jump", () => {
  test.skip(({ isMobile }) => isMobile, "rulers are a desktop feature");

  test("lands below the top ruler, not under it", async ({ page }) => {
    await page.goto("/");
    const prose = page.locator(".ProseMirror");
    await expect(prose).toBeVisible({ timeout: 20_000 });
    await prose.click();
    const filler = "Lorem ipsum dolor sit amet. ".repeat(40);
    const paragraphs = async (count: number) => {
      for (let i = 0; i < count; i++) {
        await page.keyboard.insertText(filler);
        await page.keyboard.press("Enter");
      }
    };
    await page.keyboard.type("First");
    await page.keyboard.press("Control+Alt+1");
    await page.keyboard.press("Enter");
    await paragraphs(4);
    await page.keyboard.type("Target heading");
    await page.keyboard.press("Control+Alt+2");
    await page.keyboard.press("Enter");
    await paragraphs(8);

    await page.getByTestId("sidebar-tab-outline").click();
    await page.getByTestId("outline-item").filter({ hasText: "Target heading" }).click();
    await page.waitForTimeout(1000);
    const heading = prose.locator("h2", { hasText: "Target heading" });
    const top = (await heading.boundingBox())!.y;
    const scrollTop = (await page.getByTestId("page-scroll").boundingBox())!.y;
    // The ruler covers the first 22px of the scroll area.
    expect(top - scrollTop).toBeGreaterThanOrEqual(22);
  });
});

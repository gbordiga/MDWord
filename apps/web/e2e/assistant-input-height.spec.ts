import { test, expect } from "@playwright/test";

test.describe("assistant input", () => {
  test.skip(({ isMobile }) => isMobile, "the side panel toggle is a desktop control");

  test("the chat input keeps its height after the assistant panel is closed and reopened", async ({ page }) => {
  await page.goto("/");
  const input = page.getByTestId("assistant-input");
  await expect(input).toBeVisible({ timeout: 20_000 });
  const before = (await input.boundingBox())!.height;
  for (let i = 0; i < 3; i++) {
    await page.getByTestId("topbar-assistant").click();
    await expect(input).toBeHidden();
    await page.getByTestId("topbar-assistant").click();
    await expect(input).toBeVisible();
  }
  await page.waitForTimeout(500);
  const after = (await input.boundingBox())!.height;
  expect(Math.abs(after - before)).toBeLessThan(2);
});
});

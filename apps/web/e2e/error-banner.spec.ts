import { test, expect } from "@playwright/test";

test("a failed save is announced and can be dismissed", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });

  const banner = page.getByTestId("app-error");
  await expect(banner).toHaveCount(0);

  await page.evaluate(() => {
    window.__MDWORD_APP__!.setState({
      errorMessage: "Could not save the document. Your changes are still unsaved."
    });
  });
  await expect(banner).toBeVisible();
  await expect(banner).toHaveAttribute("role", "alert");
  await expect(banner).toContainText("still unsaved");

  await banner.getByRole("button", { name: "Dismiss" }).click();
  await expect(banner).toHaveCount(0);
});

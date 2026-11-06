import { test, expect } from "@playwright/test";

test("a downloaded update is announced and can be dismissed", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });

  await page.evaluate(() => {
    window.__MDWORD_APP__!.setState({
      updateStatus: { state: "downloaded", version: "0.2.0" }
    });
  });

  const banner = page.getByTestId("update-banner");
  await expect(banner).toBeVisible();
  await expect(banner).toHaveAttribute("data-update-state", "downloaded");
  await expect(banner).toContainText("MDWord 0.2.0 is ready to install");
  await expect(banner.getByTestId("update-restart")).toBeVisible();

  await banner.getByRole("button", { name: "Dismiss update notice" }).click();
  await expect(banner).toHaveCount(0);
});

test("the download banner shows progress", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });

  await page.evaluate(() => {
    window.__MDWORD_APP__!.setState({
      updateStatus: { state: "downloading", version: "0.2.0", percent: 42 }
    });
  });

  const banner = page.getByTestId("update-banner");
  await expect(banner).toContainText("Downloading MDWord 0.2.0… 42%");
  await expect(banner.getByTestId("update-restart")).toHaveCount(0);
});

test("the web build offers no update controls", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });

  await page.getByTestId("ribbon-tab-file").click();
  await expect(page.getByTestId("check-updates")).toHaveCount(0);
  await expect(page.getByTestId("update-banner")).toHaveCount(0);
});

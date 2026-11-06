import { test, expect } from "@playwright/test";

test("an unexpected failure is announced and kept for diagnostics", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as Window & { __COPIED__?: string }).__COPIED__ = text;
        }
      }
    });
  });
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });

  await prose.click();
  await page.keyboard.type("SECRET-BODY-TEXT");

  await page.evaluate(() => {
    void Promise.reject(new TypeError("boom from test"));
  });

  const banner = page.getByTestId("app-error");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Something unexpected went wrong");

  await page.keyboard.press("ControlOrMeta+Shift+P");
  await page.getByPlaceholder("Type a command…").fill("diagnostics");
  await page.getByRole("option", { name: "Copy diagnostics" }).click();

  await expect(page.getByTestId("app-notice")).toContainText("Diagnostics copied");
  const copied = await page.evaluate(
    () => (window as Window & { __COPIED__?: string }).__COPIED__ ?? ""
  );
  const report = JSON.parse(copied) as {
    appVersion: string;
    recentErrors: { message: string; source: string }[];
  };
  expect(report.appVersion).toBeTruthy();
  expect(report.recentErrors.some((entry) => entry.message.includes("boom from test"))).toBe(true);
  expect(report.recentErrors.every((entry) => entry.source.length > 0)).toBe(true);
  expect(copied).not.toContain("SECRET-BODY-TEXT");
});

test("a cancelled picker is not treated as an unexpected failure", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });

  await page.evaluate(() => {
    void Promise.reject(Object.assign(new Error("cancelled"), { name: "AbortError" }));
  });
  await page.waitForTimeout(300);

  await expect(page.getByTestId("app-error")).toHaveCount(0);
});

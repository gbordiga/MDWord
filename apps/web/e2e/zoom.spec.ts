import { test, expect } from "@playwright/test";

test("ctrl+wheel zooms the document and prevents the default", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "View" }).click();
  await expect(page.getByTestId("zoom-level")).toHaveText("100%");
  const prevented = await page.evaluate(() => {
    const event = new WheelEvent("wheel", {
      deltaY: -120,
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(true);
  await expect(page.getByTestId("zoom-level")).not.toHaveText("100%");
  const afterIn = await page.getByTestId("zoom-level").textContent();
  expect(Number.parseInt(afterIn ?? "0", 10)).toBeGreaterThan(100);
});

test("page overlay has no fake pagination hairlines", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("page-overlay").locator(":scope > *")).toHaveCount(2);
  await expect(page.getByTestId("page-header-right")).toContainText("1 /");
  await expect(page.getByTestId("page-footer-right")).toBeVisible();
});

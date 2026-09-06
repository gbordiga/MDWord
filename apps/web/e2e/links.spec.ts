import { test, expect, type Page } from "@playwright/test";

function fmtButton(page: Page, id: string) {
  return page.locator(`[data-testid="${id}"]`).locator("visible=true");
}

async function ready(page: Page) {
  await page.addInitScript(() => {
    window.prompt = () => {
      throw new Error("native prompt should not be used");
    };
  });
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  return prose;
}

test("link dialog requires text when nothing is selected", async ({ page }) => {
  const prose = await ready(page);
  await prose.click();
  await fmtButton(page, "fmt-link").click();
  await expect(page.getByTestId("link-dialog")).toBeVisible();
  await expect(page.getByTestId("link-apply")).toBeDisabled();
  await page.getByTestId("link-url").fill("https://example.com");
  await expect(page.getByTestId("link-apply")).toBeDisabled();
  await page.getByTestId("link-text").fill("Example");
  await page.getByTestId("link-apply").click();
  await expect(page.getByTestId("link-dialog")).toBeHidden();
  const link = prose.locator('a[href="https://example.com"]');
  await expect(link).toContainText("Example");
});

test("link bubble can open and remove a link", async ({ page }) => {
  const prose = await ready(page);
  await prose.click();
  await fmtButton(page, "fmt-link").click();
  await expect(page.getByTestId("link-dialog")).toBeVisible();
  await page.getByTestId("link-text").fill("Linked text");
  await page.getByTestId("link-url").fill("https://example.com/docs");
  await page.getByTestId("link-apply").click();
  await expect(prose.locator("a")).toContainText("Linked text");

  await prose.locator("a").click();
  await expect(page.getByTestId("link-bubble")).toBeVisible();
  const popupPromise = page.waitForEvent("popup");
  await page.getByTestId("link-open").click();
  const popup = await popupPromise;
  expect(popup.url()).toContain("example.com");
  await popup.close();

  await prose.locator("a").click();
  await page.getByTestId("link-unlink").click();
  await expect(prose.locator("a")).toHaveCount(0);
  await expect(prose).toContainText("Linked text");
});

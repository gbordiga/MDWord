import { test, expect } from "@playwright/test";

test("fits the editor on a phone without horizontal overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("mobile-tab-bar")).toBeVisible();
  await expect(page.getByTestId("mobile-top-bar")).toBeVisible();
  await expect(page.getByTestId("mobile-style")).toBeVisible();
  await expect(page.getByTestId("ribbon-style")).toBeHidden();

  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });

  const overflow = await page.evaluate(() => {
    const root = document.querySelector("[data-mdword-root]") as HTMLElement | null;
    const docOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    const rootOverflow = root ? root.scrollWidth > root.clientWidth + 1 : false;
    return { docOverflow, rootOverflow, vw: window.innerWidth, canvas: document.querySelector("[data-testid=page-canvas]")?.getBoundingClientRect().width ?? 0 };
  });
  expect(overflow.docOverflow).toBe(false);
  expect(overflow.rootOverflow).toBe(false);
  expect(overflow.canvas).toBeLessThanOrEqual(overflow.vw + 1);

  await prose.click();
  await page.keyboard.type("Ciao dal telefono");
  await expect(prose).toContainText("Ciao dal telefono");
});

test("opens properties in a sheet and edits the title", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("mobile-tab-bar")).toBeVisible();
  await page.getByRole("button", { name: "Properties" }).click();
  await expect(page.getByTestId("sheet-properties")).toBeVisible();
  await page.getByTestId("sheet-properties").getByTestId("prop-title").fill("Documento mobile");
  await page.getByTestId("sheet-properties").getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("sheet-properties")).toBeHidden();
  await expect(page.getByTestId("mobile-top-bar")).toContainText("Documento mobile");
});

test("switches to source from the more menu", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "More" }).click();
  await expect(page.getByTestId("sheet-more")).toBeVisible();
  await page.getByRole("button", { name: "Source" }).click();
  await expect(page.getByTestId("source-editor")).toBeVisible();
  await expect(page.locator(".cm-editor")).toBeVisible();
});

test("applies heading 1 from the mobile format bar", async ({ page }) => {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await prose.click();
  await page.keyboard.type("Titolo mobile");
  await page.getByTestId("mobile-style").selectOption("1");
  await expect(prose.locator("h1")).toContainText("Titolo mobile");
});

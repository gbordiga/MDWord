import { test, expect, type Page } from "@playwright/test";

async function openWith(page: Page, text: string) {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await prose.click();
  await page.keyboard.type(text);
  await page.keyboard.press("ControlOrMeta+F");
  await expect(page.getByTestId("find-bar")).toBeVisible();
  return prose;
}

test("the find panel floats over the document and has match options", async ({ page }) => {
  const prose = await openWith(page, "Cat concat cat 12");
  const bar = page.getByTestId("find-bar");
  expect((await bar.evaluate((el) => getComputedStyle(el).position))).toBe("absolute");
  const input = page.getByTestId("find-input");
  await input.fill("cat");
  await expect(page.getByTestId("find-status")).toContainText("1 of 3");
  await page.getByTestId("find-case").click();
  await expect(page.getByTestId("find-status")).toContainText(" of 2");
  await page.getByTestId("find-case").click();
  await page.getByTestId("find-word").click();
  await expect(page.getByTestId("find-status")).toContainText(" of 2");
  await page.getByTestId("find-word").click();
  await page.getByTestId("find-regex").click();
  await input.fill("\\d+");
  await expect(page.getByTestId("find-status")).toContainText(" of 1");
  await input.fill("(");
  await expect(page.getByTestId("find-status")).toContainText("Invalid pattern");
  await expect(prose.locator('[data-testid="find-match"]')).toHaveCount(0);
});

test("replace one and replace all use regex groups", async ({ page }) => {
  const prose = await openWith(page, "red fox, red hen");
  await page.getByTestId("find-input").fill("red");
  await page.getByTestId("find-toggle-replace").click();
  await page.getByTestId("replace-input").fill("blue");
  await page.getByTestId("replace-one").click();
  await expect(prose).toContainText("blue fox, red hen");
  await page.getByTestId("replace-all").click();
  await expect(prose).toContainText("blue fox, blue hen");

  await page.getByTestId("find-regex").click();
  await page.getByTestId("find-input").fill("(blue) (\\w+)");
  await page.getByTestId("replace-input").fill("$2 $1");
  await page.getByTestId("replace-all").click();
  await expect(prose).toContainText("fox blue, hen blue");
});

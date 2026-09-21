import { test, expect } from "@playwright/test";

test("Ctrl+Z undoes a sidebar property and clears dirty when it was the only change", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("prop-title").fill("Changed title");
  await expect(page.getByTestId("doc-title")).toContainText("Changed title");
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-save-state", "unsaved");
  await page.keyboard.press("ControlOrMeta+Z");
  await expect(page.getByTestId("prop-title")).toHaveValue("Untitled");
  await expect.poll(() => page.evaluate(() => window.__MDWORD_APP__!.getState().dirty)).toBe(false);
});

test("text, margins and title undo back to the opening document", async ({ page }) => {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await prose.click();
  await page.keyboard.type("Typed body");
  await expect(prose).toContainText("Typed body");
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "Layout" }).click();
  await page.getByTestId("ribbon-margins").selectOption("narrow");
  await expect(page.getByTestId("ribbon-margins")).toHaveValue("narrow");
  await page.getByTestId("prop-title").fill("Three steps");
  await expect(page.getByTestId("prop-title")).toHaveValue("Three steps");

  await page.keyboard.press("ControlOrMeta+Z");
  await expect(page.getByTestId("prop-title")).toHaveValue("Untitled");
  await expect(page.getByTestId("ribbon-margins")).toHaveValue("narrow");
  await expect(prose).toContainText("Typed body");

  await page.keyboard.press("ControlOrMeta+Z");
  await expect(page.getByTestId("ribbon-margins")).toHaveValue("normal");
  await expect(prose).toContainText("Typed body");

  await page.keyboard.press("ControlOrMeta+Z");
  await expect(prose).not.toContainText("Typed body");
  await expect.poll(() => page.evaluate(() => window.__MDWORD_APP__!.getState().dirty)).toBe(false);
});

test("undoing a property keeps the body text", async ({ page }) => {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await prose.click();
  await page.keyboard.type("Keep this sentence");
  await expect(prose).toContainText("Keep this sentence");
  await page.waitForTimeout(250);
  await page.getByTestId("prop-title").fill("Temp title");
  await page.keyboard.press("ControlOrMeta+Z");
  await expect(page.getByTestId("prop-title")).toHaveValue("Untitled");
  await expect(prose).toContainText("Keep this sentence");
});

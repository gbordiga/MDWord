import { test, expect } from "@playwright/test";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test("History shows a structured summary, not a line dump", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("prop-title").fill("Beta title");
  await page.getByRole("button", { name: "history", exact: true }).click();
  await expect(page.getByTestId("history-pane")).toBeVisible();
  await expect(page.getByTestId("history-summary")).toContainText("Title:");
  await expect(page.getByTestId("history-summary")).toContainText("Beta title");
  await expect(page.getByTestId("history-summary")).not.toContainText("mdoc:");
  await expect(page.getByTestId("history-diff").locator("pre")).toHaveCount(0);
});

test("embedded image snapshots never dump base64", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  await page.evaluate(async (source) => {
    await window.__MDWORD_APP__!.getState().restoreHistory(`# Photo\n\n![dot](${source})\n`);
  }, PNG);
  await page.locator(".ProseMirror").click();
  await page.keyboard.type("After the photo");
  await page.getByRole("button", { name: "history", exact: true }).click();
  await expect(page.getByTestId("history-pane")).toBeVisible();
  const pane = page.getByTestId("history-diff");
  await expect(pane).not.toContainText("data:image");
  await expect(pane).not.toContainText("base64");
  await expect(page.getByTestId("history-summary")).toContainText("paragraph");
});

import { test, expect } from "@playwright/test";

test("inserts a Mermaid diagram and keeps the fence in source", async ({ page }) => {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Insert" }).click();
  await page.getByTestId("insert-mermaid").click();
  const diagram = prose.getByTestId("doc-mermaid");
  await expect(diagram).toBeVisible();
  await expect(diagram.locator("svg")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "View" }).click();
  await page.getByTitle("Source").click();
  await expect(page.getByTestId("source-editor")).toBeVisible();
  await expect(page.locator(".cm-content")).toContainText("```mermaid");
  await expect(page.locator(".cm-content")).toContainText("flowchart TB");
});

test("PDF export inlines a rendered Mermaid SVG", async ({ page }) => {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Insert" }).click();
  await page.getByTestId("insert-mermaid").click();
  await expect(prose.getByTestId("doc-mermaid").locator("svg")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByTitle("Export PDF").click();
  await page.waitForFunction(
    () => Boolean((window as Window & { __MDWORD_LAST_EXPORT_HTML__?: string }).__MDWORD_LAST_EXPORT_HTML__),
    null,
    { timeout: 20_000 }
  );
  const html = await page.evaluate(
    () => (window as Window & { __MDWORD_LAST_EXPORT_HTML__?: string }).__MDWORD_LAST_EXPORT_HTML__ ?? ""
  );
  expect(html).toContain("md-mermaid");
  expect(html).toContain("<svg");
});

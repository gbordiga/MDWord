import { test, expect } from "@playwright/test";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

test("ribbon file and insert groups use Lucide icons", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "File", exact: true }).click();
  await expect(page.getByRole("button", { name: "New", exact: true }).locator("svg")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open folder" }).locator("svg")).toBeVisible();
  await page.getByRole("button", { name: "Insert" }).click();
  await expect(page.getByTestId("insert-callout").locator("svg")).toBeVisible();
  await expect(page.getByTitle("Page break").locator("svg")).toBeVisible();
  await expect(page.getByTitle("Wikilink").locator("svg")).toBeVisible();
});

test("choosing a local image embeds it in the document", async ({ page }) => {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Insert" }).click();
  await page.getByTitle("Image").click();
  await expect(page.getByTestId("image-dialog")).toBeVisible();
  await page.getByTestId("image-file").setInputFiles({
    name: "dot.png",
    mimeType: "image/png",
    buffer: TINY_PNG
  });
  await expect(page.getByTestId("image-dialog").locator("img")).toBeVisible();
  await page.getByTestId("image-insert").click();
  await expect(prose.locator("img")).toBeVisible();
  await expect(prose.locator("img")).toHaveAttribute("src", /^data:image\/png/);
});

test("Normal and Report templates explain their differences", async ({ page }) => {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Layout" }).click();
  await expect(page.getByTestId("template-hint")).toContainText("no table of contents");
  await page.getByTestId("ribbon-template").selectOption("report");
  await expect(page.getByTestId("template-hint")).toContainText("live table of contents");
  await expect(page.getByTestId("document-toc")).toBeVisible();
  await page.getByTestId("ribbon-template").selectOption("technical-report");
  await expect(page.getByTestId("template-hint")).toContainText("10pt");
  await expect(page.getByTestId("prop-template-hint")).toContainText("10pt");
});

test("header and footer fields match the page overlay", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("page-header-right")).toContainText("1 / …");
  await expect(page.getByTestId("prop-header-left")).toBeVisible();
  await expect(page.getByTestId("prop-header-center")).toBeVisible();
  await expect(page.getByTestId("prop-footer-center")).toBeVisible();
  await page.getByTestId("prop-footer-center").fill("Confidential");
  await expect(page.getByTestId("page-footer-center")).toContainText("Confidential");
});

test("page break does not report an unknown directive", async ({ page }) => {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Insert" }).click();
  await page.getByTitle("Page break").click();
  await expect(page.locator(".page-break-block")).toBeVisible();
  await page.getByRole("button", { name: "View" }).click();
  await page.getByTitle("Source").click();
  await expect(page.getByTestId("source-editor")).toBeVisible();
  await expect(page.locator(".cm-content")).toContainText("page-break");
  await expect(page.getByTestId("diagnostics")).toHaveCount(0);
});

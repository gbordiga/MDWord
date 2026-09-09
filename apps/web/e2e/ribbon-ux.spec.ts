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
  await page.getByTestId("insert-image").click();
  await expect(page.getByTestId("image-dialog")).toBeVisible();
  await page.getByTestId("image-file").setInputFiles({
    name: "dot.png",
    mimeType: "image/png",
    buffer: TINY_PNG
  });
  await expect(page.getByTestId("image-dialog").locator("img")).toBeVisible();
  await page.getByTestId("image-insert").click();
  await expect(prose.locator("img")).toBeVisible();
  await expect(prose.locator("img")).toHaveAttribute("src", /^(blob:|data:image\/)/);
  await expect(page.getByTestId("ribbon-tab-image")).toBeEnabled();
  const imageFloat = page.locator("div.hidden.lg\\:block").getByTestId("image-float-left");
  await expect(imageFloat).toBeEnabled();
  await imageFloat.click();
  await expect(prose.locator('[data-testid="doc-figure"]')).toHaveAttribute("data-layout", "float-left");
});

test("can type under an inserted image and move it", async ({ page }) => {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Insert" }).click();
  await page.getByTestId("insert-image").click();
  await page.getByTestId("image-file").setInputFiles({
    name: "dot.png",
    mimeType: "image/png",
    buffer: TINY_PNG
  });
  await page.getByTestId("image-insert").click();
  await expect(prose.locator('[data-testid="doc-figure"]')).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.type("Text under the photo");
  await expect(prose.locator("p", { hasText: "Text under the photo" })).toBeVisible();
  const imageRibbon = page.locator("div.hidden.lg\\:block");
  const moveDown = imageRibbon.getByTestId("image-move-down");
  await prose.locator('[data-testid="doc-image"]').click();
  await expect(moveDown).toBeEnabled();
  await imageRibbon.getByTestId("image-caption").fill("Schema della pompa");
  await expect(prose.locator("figcaption")).toContainText("Schema della pompa");
  await expect(imageRibbon.getByTestId("image-caption")).toHaveValue("Schema della pompa");
  await moveDown.click();
  const figureBox = await prose.locator('[data-testid="doc-figure"]').boundingBox();
  const textBox = await prose.locator("p", { hasText: "Text under the photo" }).boundingBox();
  expect(figureBox && textBox).toBeTruthy();
  expect(textBox!.y).toBeLessThan(figureBox!.y);
});

test("page layout controls stay in Properties", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("prop-section-page")).toBeVisible();
  await expect(page.getByTestId("prop-section-margins")).toBeVisible();
  await expect(page.getByTestId("prop-section-running")).toBeVisible();
  await expect(page.getByTestId("prop-section-toc")).toBeVisible();
  await expect(page.getByTestId("ribbon-template")).toHaveCount(0);
});

test("header and footer fields match the page overlay", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("page-header-right")).toContainText("1 /");
  await page.getByTestId("prop-section-running").locator("summary").click();
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

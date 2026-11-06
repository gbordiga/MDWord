import { test, expect } from "@playwright/test";

const SOURCE = `---
title: Outline fixture
mdoc:
  version: 1
  toc:
    enabled: true
    depth: 3
---

# Alpha

## Beta

### Gamma
`;

test("the page outline follows the file that was opened", async ({ page }) => {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });

  await page.evaluate((source) => {
    if (!window.__MDWORD_PRIME_FILE__) throw new Error("File priming hook is not available");
    window.__MDWORD_PRIME_FILE__("/notes/outline.md", source);
  }, SOURCE);
  await page.evaluate(() => window.__MDWORD_APP__!.getState().openWorkspaceFile("/notes/outline.md"));

  const toc = page.getByTestId("document-toc");
  await expect(toc).toBeVisible();
  await expect(toc.getByRole("button")).toHaveText(["Alpha", "Beta", "Gamma"]);
});

test("the outline lists every heading and jumps to the one that was clicked", async ({ page }) => {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });

  await page.evaluate(() => {
    void window.__MDWORD_APP__!
      .getState()
      .replaceDocument("---\ntitle: Fixture\n---\n\n#\n\n## Alpha\n\n## Target\n");
  });
  await expect(prose.locator("h2", { hasText: "Target" })).toBeVisible();

  await page.getByRole("button", { name: "View" }).click();
  await page.getByTitle("Outline", { exact: true }).click();

  const items = page.getByTestId("outline-item");
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText("Untitled");
  await expect(items.nth(1)).toContainText("Alpha");

  await items.nth(2).click();
  const selectedHeading = await page.evaluate(() => {
    const node = window.getSelection()?.anchorNode ?? null;
    const el = node instanceof Element ? node : node?.parentElement ?? null;
    return el?.closest("h1, h2, h3, h4, h5, h6")?.textContent ?? "";
  });
  expect(selectedHeading).toBe("Target");
});

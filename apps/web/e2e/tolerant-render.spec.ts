import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const fixture = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/real-world/ipr001.md"
);

test("opens a process document with empty table cells and Italian titolo", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });

  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "File", exact: true }).click().then(async () => {
      await page.getByTitle("Open").click();
    })
  ]);
  await chooser.setFiles(fixture);

  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible();
  await expect(page.getByTestId("visual-editor-error")).toHaveCount(0);
  await expect(page.getByTestId("doc-title")).toHaveText("Direzione strategica");
  await expect(prose).toContainText("Direzione strategica");
  await expect(prose).toContainText("Process Owner");
  await expect(prose.locator("table").first()).toBeVisible();
  await expect(page.getByTestId("prop-title")).toHaveValue("Direzione strategica");
});

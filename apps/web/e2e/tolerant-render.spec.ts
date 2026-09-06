import path from "node:path";
import { existsSync } from "node:fs";
import { test, expect } from "@playwright/test";

const fixture = [
  path.resolve(process.cwd(), "fixtures/real-world/ipr001.md"),
  path.resolve(process.cwd(), "../../fixtures/real-world/ipr001.md")
].find((candidate) => existsSync(candidate));

test("opens a process document with empty table cells and Italian titolo", async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, "showOpenFilePicker");
  });
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });

  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "File", exact: true }).click().then(async () => {
      await page.getByRole("button", { name: "Open", exact: true }).click();
    })
  ]);
  if (!fixture) {
    throw new Error("IPR001 fixture not found");
  }
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

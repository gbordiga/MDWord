import { test, expect } from "@playwright/test";

async function seedWorkspace(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => {
    const store = window.__MDWORD_APP__;
    if (!store) throw new Error("App store is not available");
    store.setState({
      left: "files",
      leftOpen: true,
      workspace: {
        root: "/notes",
        files: [
          { path: "/notes/drafts", name: "drafts", isDirectory: true },
          { path: "/notes/drafts/idea.md", name: "idea.md", isDirectory: false },
          { path: "/notes/readme.md", name: "readme.md", isDirectory: false }
        ],
        index: { documents: [] },
        workspaceMdoc: undefined
      }
    });
  });
  await expect(page.getByTestId("workspace-files")).toBeVisible();
}

test("file sidebar has collapse and create buttons", async ({ page }) => {
  await seedWorkspace(page);
  await expect(page.getByTestId("workspace-new-file")).toBeVisible();
  await expect(page.getByTestId("workspace-new-folder")).toBeVisible();
  await expect(page.getByTestId("workspace-collapse-all")).toBeVisible();
  await expect(page.getByTestId("workspace-file").filter({ hasText: "idea.md" })).toBeVisible();
  await page.getByTestId("workspace-collapse-all").click();
  await expect(page.getByTestId("workspace-file").filter({ hasText: "idea.md" })).toHaveCount(0);
  await page.getByTestId("workspace-new-file").click();
  await expect(page.getByTestId("workspace-name-dialog")).toBeVisible();
  await expect(page.getByTestId("workspace-name-input")).toHaveValue("Untitled.md");
  await page.getByRole("button", { name: "Cancel" }).click();
});

test("right-clicking a file opens the workspace context menu", async ({ page }) => {
  await seedWorkspace(page);
  await page.getByTestId("workspace-file").filter({ hasText: "readme.md" }).click({ button: "right" });
  const menu = page.getByTestId("workspace-context-menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByTestId("workspace-menu-file")).toBeVisible();
  await expect(menu.getByTestId("workspace-menu-folder")).toBeVisible();
  await expect(menu.getByTestId("workspace-menu-rename")).toBeEnabled();
  await expect(menu.getByTestId("workspace-menu-copy")).toBeEnabled();
  await expect(menu.getByTestId("workspace-menu-paste")).toBeDisabled();
  await expect(menu.getByTestId("workspace-menu-delete")).toBeEnabled();
  await menu.getByTestId("workspace-menu-rename").click();
  await expect(page.getByTestId("workspace-name-dialog")).toBeVisible();
  await expect(page.getByTestId("workspace-name-input")).toHaveValue("readme.md");
});

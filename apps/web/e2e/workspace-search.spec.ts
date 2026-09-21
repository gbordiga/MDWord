import { test, expect } from "@playwright/test";

test("workspace search stays empty until a query, then shows why it matched", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => {
    const store = window.__MDWORD_APP__;
    if (!store) throw new Error("App store is not available");
    if (!window.__MDWORD_PRIME_FILE__) throw new Error("File priming hook is not available");
    window.__MDWORD_PRIME_FILE__("/notes/pump.md", "# Pump notes\n\nThe centrifugal pump needs oil.\n");
    store.setState({
      left: "search",
      leftOpen: true,
      workspace: {
        root: "/notes",
        files: [
          { path: "/notes/pump.md", name: "pump.md", isDirectory: false },
          { path: "/notes/other.md", name: "other.md", isDirectory: false }
        ],
        index: {
          documents: [
            {
              path: "/notes/pump.md",
              title: "Pump notes",
              aliases: ["pump"],
              headings: [{ text: "Pump notes", slug: "pump-notes", depth: 1 }],
              tags: ["qms"],
              wikilinks: [],
              plainText: "The centrifugal pump needs oil.",
              modifiedMs: 0
            },
            {
              path: "/notes/other.md",
              title: "Other",
              aliases: ["other"],
              headings: [],
              tags: [],
              wikilinks: [],
              plainText: "Nothing here.",
              modifiedMs: 0
            }
          ]
        },
        workspaceMdoc: undefined
      }
    });
  });

  await expect(page.getByTestId("workspace-search")).toBeVisible();
  await expect(page.getByTestId("search-empty-hint")).toBeVisible();
  await expect(page.getByTestId("search-result")).toHaveCount(0);

  await page.getByTestId("workspace-search").fill("centrifugal");
  const hit = page.getByTestId("search-result");
  await expect(hit).toHaveCount(1);
  await expect(hit).toContainText("Pump notes");
  await expect(hit.getByTestId("search-result-path")).toHaveText("pump.md");
  await expect(hit.getByTestId("search-result-excerpt")).toContainText("centrifugal");
  await expect(hit.getByTestId("search-result-field")).toHaveText("Matched in text");

  await hit.click();
  await expect(page.locator('[data-testid="document-tab"][data-active="true"]:visible')).toHaveAttribute(
    "data-preview",
    "true"
  );
});

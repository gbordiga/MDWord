import { test, expect, type Page } from "@playwright/test";

const PARENT = `---
title: "Parent note"
---

See [[Target]] please.
`;

const TARGET = `---
title: "Target note"
---

# Target heading

Unique child body.
`;

async function seedWikiWorkspace(page: Page) {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  await page.evaluate(
    ({ parent, target }) => {
      const store = window.__MDWORD_APP__;
      if (!store) throw new Error("App store is not available");
      if (!window.__MDWORD_PRIME_FILE__) throw new Error("File priming hook is not available");
      window.__MDWORD_PRIME_FILE__("/notes/parent.md", parent);
      window.__MDWORD_PRIME_FILE__("/notes/target.md", target);
      store.setState({
        workspace: {
          root: "/notes",
          files: [
            { path: "/notes/parent.md", name: "parent.md", isDirectory: false },
            { path: "/notes/target.md", name: "target.md", isDirectory: false }
          ],
          index: {
            documents: [
              {
                path: "/notes/parent.md",
                title: "Parent note",
                aliases: [],
                headings: [],
                tags: [],
                wikilinks: [{ target: "Target" }],
                plainText: "See Target please.",
                modifiedMs: 0
              },
              {
                path: "/notes/target.md",
                title: "Target note",
                aliases: [],
                headings: [{ text: "Target heading", slug: "target-heading", depth: 1 }],
                tags: [],
                wikilinks: [],
                plainText: "Target heading Unique child body.",
                modifiedMs: 0
              }
            ]
          },
          workspaceMdoc: undefined
        }
      });
    },
    { parent: PARENT, target: TARGET }
  );
  await page.evaluate(() => window.__MDWORD_APP__!.getState().openWorkspaceFile("/notes/parent.md"));
  await expect(page.locator(".ProseMirror")).toContainText("See");
  await expect(page.getByTestId("wikilink")).toBeVisible();
}

test("wikilink click opens the target document, not the parent", async ({ page }) => {
  await seedWikiWorkspace(page);
  await page.getByTestId("wikilink").click();
  await expect(page.locator(".ProseMirror")).toContainText("Unique child body");
  await expect(page.locator(".ProseMirror")).not.toContainText("See");
  await expect(page.locator('[data-testid="document-tab"][data-active="true"]:visible')).toContainText("Target note");
  await expect(page.getByTestId("doc-title")).toHaveText("Target note");
});

test("switching parent and target tabs keeps their contents apart", async ({ page }) => {
  await seedWikiWorkspace(page);
  await page.getByTestId("wikilink").click();
  await expect(page.locator(".ProseMirror")).toContainText("Unique child body");

  await page.locator('[data-testid="document-tab"]:visible').filter({ hasText: "Parent note" }).click();
  await expect(page.locator(".ProseMirror")).toContainText("See");
  await expect(page.locator(".ProseMirror")).not.toContainText("Unique child body");

  await page.locator('[data-testid="document-tab"]:visible').filter({ hasText: "Target note" }).click();
  await expect(page.locator(".ProseMirror")).toContainText("Unique child body");
  await expect(page.locator(".ProseMirror")).not.toContainText("See");
});

test("wikilink target stays correct in source and split views", async ({ page }) => {
  await seedWikiWorkspace(page);
  await page.getByTestId("wikilink").click();
  await expect(page.locator(".ProseMirror")).toContainText("Unique child body");

  await page.evaluate(() => window.__MDWORD_APP__!.getState().setView("source"));
  await expect(page.getByTestId("source-editor")).toBeVisible();
  await expect(page.locator(".cm-editor")).toContainText("Unique child body");
  await expect(page.locator(".cm-editor")).not.toContainText("See [[Target]]");

  await page.evaluate(() => window.__MDWORD_APP__!.getState().setView("split"));
  await expect(page.locator(".ProseMirror")).toContainText("Unique child body");
  await expect(page.locator(".cm-editor")).toContainText("Unique child body");
});

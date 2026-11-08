import { test, expect } from "@playwright/test";

test("Properties is a sidebar tab and the right side holds only the assistant, open from the start", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });

  const tabs = page.getByRole("tablist", { name: "Sidebar" }).getByRole("tab");
  await expect(tabs).toHaveCount(4);
  await expect(page.getByTestId("sidebar-tab-properties")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("prop-title")).toBeVisible();
  await expect(page.getByTestId("assistant-panel")).toBeVisible();

  // Only the open tab shows its name; every tab keeps an accessible name.
  await expect(page.getByTestId("sidebar-tab-properties")).toContainText("Properties");
  await expect(page.getByTestId("sidebar-tab-outline")).not.toContainText("Outline");
  await expect(page.getByTestId("sidebar-tab-outline")).toHaveAttribute("aria-label", /Headings/);
});

test("sidebar tabs follow arrow keys and the panel is labelled by the tab", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("sidebar-tab-properties").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("sidebar-tab-outline")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("sidebar-tab-outline")).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByTestId("sidebar-tab-search")).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("sidebar-tab-properties")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "sidebar-tab-properties");
});

test("the top bar has only Sidebar and Assistant toggles, and Properties stays in the sidebar", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("topbar-sidebar")).toBeVisible();
  await expect(page.getByTestId("topbar-assistant")).toBeVisible();
  await expect(page.getByTestId("topbar-properties")).toHaveCount(0);

  await expect(page.getByTestId("topbar-assistant")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("topbar-assistant").click();
  await expect(page.getByTestId("assistant-panel")).toHaveCount(0);
  await page.getByTestId("topbar-assistant").click();
  await expect(page.getByTestId("assistant-panel")).toBeVisible();

  await page.getByTestId("topbar-sidebar").click();
  await expect(page.getByTestId("prop-title")).toBeHidden();
  await page.getByTestId("topbar-sidebar").click();
  await expect(page.getByTestId("sidebar-tab-properties")).toBeVisible();
});

import { test, expect } from "@playwright/test";

test("Properties is a sidebar tab and the right side holds only the assistant", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });

  const tabs = page.getByRole("tablist", { name: "Sidebar" }).getByRole("tab");
  await expect(tabs).toHaveCount(4);
  await expect(page.getByTestId("sidebar-tab-properties")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("prop-title")).toBeVisible();
  await expect(page.getByTestId("assistant-panel")).toHaveCount(0);

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

test("the Properties button toggles the Properties tab, reopening a closed sidebar", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  const button = page.getByTestId("topbar-properties");
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await button.click();
  await expect(page.getByTestId("prop-title")).toBeHidden();
  await button.click();
  await expect(page.getByTestId("prop-title")).toBeVisible();

  await page.getByTestId("sidebar-tab-outline").click();
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await button.click();
  await expect(page.getByTestId("sidebar-tab-properties")).toHaveAttribute("aria-selected", "true");
});

import { test, expect } from "@playwright/test";

async function seedOverflowTabs(page: import("@playwright/test").Page, count = 16) {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  await page.evaluate((total) => {
    const store = window.__MDWORD_APP__;
    if (!store) throw new Error("App store is not available");
    const base = store.getState().tabs[0];
    if (!base) throw new Error("No tab to clone");
    const tabs = Array.from({ length: total }, (_, index) => ({
      ...base,
      id: `overflow-tab-${index}`,
      preview: false,
      model: {
        ...base.model,
        frontmatter: { ...base.model.frontmatter, title: `Long document title ${index + 1}` }
      }
    }));
    store.setState({
      tabs,
      activeTabId: tabs[0]!.id,
      model: tabs[0]!.model,
      path: tabs[0]!.path,
      dirty: false
    });
  }, count);
}

function visibleTabBar(page: import("@playwright/test").Page) {
  return page.locator('[data-testid="document-tab-bar"]:visible');
}

function visibleScroller(page: import("@playwright/test").Page) {
  return page.locator('[data-testid="document-tab-scroller"]:visible');
}

async function expectActiveTabVisible(page: import("@playwright/test").Page) {
  const tab = visibleTabBar(page).locator('[data-testid="document-tab"][data-active="true"]');
  const scroller = visibleScroller(page);
  await expect(tab).toBeVisible();
  const tabBox = await tab.boundingBox();
  const stripBox = await scroller.boundingBox();
  expect(tabBox).toBeTruthy();
  expect(stripBox).toBeTruthy();
  expect(tabBox!.x).toBeGreaterThanOrEqual(stripBox!.x - 2);
  expect(tabBox!.x + tabBox!.width).toBeLessThanOrEqual(stripBox!.x + stripBox!.width + 2);
}

test("hides the tab scrollbar and uses carets to reveal overflow", async ({ page }) => {
  await seedOverflowTabs(page);
  const bar = visibleTabBar(page);
  const scroller = visibleScroller(page);
  await expect(bar).toBeVisible();

  const metrics = await scroller.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    scrollbar: el.offsetHeight - el.clientHeight
  }));
  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
  expect(metrics.scrollbar).toBe(0);
  await expect(bar.getByTestId("document-tab-scroll-right")).toBeVisible();
  await expect(bar.getByTestId("document-tab-scroll-left")).toHaveCount(0);

  await bar.getByTestId("document-tab-scroll-right").click();
  await expect(bar.getByTestId("document-tab-scroll-left")).toBeVisible();

  await visibleTabBar(page).locator('[data-testid="document-tab"]').last().getByTestId("document-tab-title").click();
  await expectActiveTabVisible(page);
});

test("keeps the active tab in view after a narrow resize", async ({ page }) => {
  await seedOverflowTabs(page);
  await page.setViewportSize({ width: 1100, height: 720 });
  await expect(visibleTabBar(page).getByTestId("document-tab-scroll-right")).toBeVisible();
  await visibleTabBar(page).locator('[data-testid="document-tab"]').last().getByTestId("document-tab-title").click();
  await expectActiveTabVisible(page);
});

test("keeps left overflow reachable after the last tab is selected", async ({ page }) => {
  await seedOverflowTabs(page);
  const bar = visibleTabBar(page);
  const scroller = visibleScroller(page);
  await bar.locator('[data-testid="document-tab"]').last().getByTestId("document-tab-title").click();
  await expect(bar.getByTestId("document-tab-scroll-left")).toBeVisible();
  const before = await scroller.evaluate((el) => el.scrollLeft);
  expect(before).toBeGreaterThan(0);
  await bar.getByTestId("document-tab-scroll-left").click();
  await expect.poll(() => scroller.evaluate((el) => el.scrollLeft)).toBeLessThan(before - 20);
  await expect(bar.getByTestId("document-tab-scroll-right")).toBeVisible();
});

test("closes a tab with a middle click on the badge", async ({ page }) => {
  await seedOverflowTabs(page, 3);
  const bar = visibleTabBar(page);
  await expect(bar.locator('[data-testid="document-tab"]')).toHaveCount(3);
  await bar.locator('[data-testid="document-tab"]').nth(1).click({ button: "middle" });
  await expect(bar.locator('[data-testid="document-tab"]')).toHaveCount(2);
  await expect(bar).not.toContainText("Long document title 2");
});

test("uses carets on the compact mobile tab bar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedOverflowTabs(page, 10);
  const bar = page.getByTestId("mobile-top-bar").getByTestId("document-tab-bar");
  await expect(bar).toBeVisible();
  const metrics = await bar.getByTestId("document-tab-scroller").evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    scrollbar: el.offsetHeight - el.clientHeight
  }));
  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
  expect(metrics.scrollbar).toBe(0);
  await expect(bar.getByTestId("document-tab-scroll-right")).toBeVisible();
});

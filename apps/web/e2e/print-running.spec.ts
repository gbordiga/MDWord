import { test, expect } from "@playwright/test";

test("Paged.js print preview starts on page 1 with repeating header and footer", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("prop-title").fill("Audit report");
  await page.locator(".ProseMirror").click();
  await page.keyboard.insertText(
    Array.from({ length: 28 }, (_, i) => `Paragraph ${i + 1}. ${"Lorem ipsum dolor sit amet. ".repeat(6)}`).join(
      "\n\n"
    )
  );
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByTitle("Export PDF").click();
  await page.waitForFunction(
    () => Boolean((window as Window & { __MDWORD_LAST_EXPORT_HTML__?: string }).__MDWORD_LAST_EXPORT_HTML__)
  );
  const html = await page.evaluate(
    () => (window as Window & { __MDWORD_LAST_EXPORT_HTML__?: string }).__MDWORD_LAST_EXPORT_HTML__ ?? ""
  );
  expect(html).not.toContain("<thead>");
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.documentElement.dataset.pagedReady === "1", null, {
    timeout: 15_000
  });
  const pages = page.locator(".pagedjs_page");
  expect(await pages.count()).toBeGreaterThan(1);
  const first = (await pages.nth(0).innerText()).replace(/\s+/g, " ");
  const second = (await pages.nth(1).innerText()).replace(/\s+/g, " ");
  expect(first).toMatch(/Paragraph 1/);
  expect(first).toMatch(/Audit report/);
  expect(second).not.toMatch(/Paragraph 1\./);
  expect(second).toMatch(/Paragraph \d+/);
});

import { test, expect } from "@playwright/test";

const AGENTS_MD = `# AGENTS

Istruzioni operative del vault: **[\`.agents/AGENT.md\`](.agents/AGENT.md)**
Memoria di progetto: **[\`memory/MEMORY.md\`](memory/MEMORY.md)**

Leggere entrambi prima di lavorare sul SGQ Micron/Durox.

Questo vault è la **nuova versione del SGQ** in ricostruzione. Le NC in \`QMS/Gruppo/Audit Certificazione/\` sono sul sistema legacy — verificare la chiusura sul nuovo (vedi \`.agents/AGENT.md\` e \`memory/decision_nuovo_sgq_vs_nc_legacy.md\`).

**Nei documenti QMS:** non indicare cosa un documento “sostituisce” del sistema legacy. Wiki-link con alias **codice + titolo**.

**Fonti legacy:** preferire \`QMS/tmp/_extract_legacy_micron/md/\` (csv/pbix accanto); originali Word/Excel/PDF solo se l’extract manca o è fallito.
`;

test("renders AGENTS-style notes with bold code links in Document view", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 20_000 });
  await page.evaluate(async (source) => {
    await window.__MDWORD_APP__!.getState().replaceDocument(source);
  }, AGENTS_MD);

  const prose = page.locator(".ProseMirror");
  await expect(page.getByTestId("visual-editor-error")).toHaveCount(0);
  await expect(prose).toContainText("AGENTS");
  await expect(prose).toContainText(".agents/AGENT.md");
  await expect(prose).toContainText("memory/MEMORY.md");
  await expect(prose.locator('a[href=".agents/AGENT.md"]')).toBeVisible();
  await expect(prose.locator("strong").first()).toBeVisible();
});

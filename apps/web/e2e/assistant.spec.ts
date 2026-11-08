import { test, expect, type Page, type Route } from "@playwright/test";

const KEY = "sk-or-v1-test0123456789abcdef0123456789";

function sse(chunks: unknown[]): string {
  return chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
}

const base = { id: "gen-1", object: "chat.completion.chunk", created: 1, model: "qwen/qwen3.8-flash" };

function toolCall(name: string, args: unknown): string {
  return sse([
    {
      ...base,
      choices: [
        {
          index: 0,
          delta: {
            role: "assistant",
            content: null,
            tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name, arguments: JSON.stringify(args) } }]
          },
          finish_reason: null
        }
      ]
    },
    { ...base, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] },
    { ...base, choices: [], usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120, cost: 0.0005 } }
  ]);
}

function text(content: string): string {
  return sse([
    { ...base, choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }] },
    { ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] },
    { ...base, choices: [], usage: { prompt_tokens: 150, completion_tokens: 10, total_tokens: 160, cost: 0.0004 } }
  ]);
}

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS"
};

async function mockOpenRouter(page: Page, replies: string[]) {
  const requests: { headers: Record<string, string>; body: Record<string, unknown> }[] = [];
  await page.route("https://openrouter.ai/**", async (route: Route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (req.url().includes("/api/v1/models")) {
      return route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify({ data: [] }) });
    }
    if (req.url().includes("/chat/completions")) {
      requests.push({ headers: req.headers(), body: JSON.parse(req.postData() ?? "{}") });
      const body = replies[Math.min(requests.length - 1, replies.length - 1)]!;
      return route.fulfill({ status: 200, headers: { ...cors, "content-type": "text/event-stream" }, body });
    }
    return route.fulfill({ status: 404, headers: cors, body: "{}" });
  });
  return requests;
}

async function withKey(page: Page, accepted = true) {
  await page.addInitScript(
    ([key, ok]) => {
      localStorage.setItem("mdword.assistant.openrouterKey", key as string);
      localStorage.setItem(
        "mdword.assistant.settings",
        JSON.stringify({ modelId: "qwen/qwen3.8-flash", spendCapUsd: 3, privacyOnly: true, noticeAccepted: ok })
      );
    },
    [KEY, accepted]
  );
}

async function openAssistant(page: Page) {
  await page.goto("/");
  const prose = page.locator(".ProseMirror");
  await expect(prose).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("topbar-assistant").click();
  await expect(page.getByTestId("assistant-panel")).toBeVisible();
  return prose;
}

test("without a key the input is disabled and settings are offered", async ({ page }) => {
  await mockOpenRouter(page, [text("unused")]);
  await openAssistant(page);
  await expect(page.getByTestId("assistant-input")).toBeDisabled();
  await expect(page.getByTestId("assistant-nokey")).toBeVisible();
  await page.getByTestId("assistant-nokey-open").click();
  await expect(page.getByTestId("assistant-settings")).toBeVisible();
  await expect(page.getByTestId("assistant-sign-in")).toBeVisible();
  await page.getByTestId("assistant-key-input").fill("not a key");
  await page.getByTestId("assistant-key-save").click();
  await expect(page.getByTestId("assistant-settings").getByRole("alert")).toBeVisible();
  await page.getByTestId("assistant-key-input").fill(KEY);
  await page.getByTestId("assistant-key-save").click();
  await expect(page.getByTestId("assistant-key-masked")).toContainText("sk-or-");
  await expect(page.getByTestId("assistant-key-masked")).not.toContainText("0123456789abcdef0123");
});

test("a proposed edit changes nothing until Apply, and Apply is one undo step", async ({ page }) => {
  await withKey(page);
  const requests = await mockOpenRouter(page, [
    toolCall("editFile", { path: "Untitled-1.md", edits: [{ oldText: "Hello world", newText: "Hello there" }] }),
    text("I changed the greeting.")
  ]);
  const prose = await openAssistant(page);
  await prose.click();
  await page.keyboard.type("Hello world");
  await expect(prose).toContainText("Hello world");

  await page.getByTestId("assistant-input").fill("Make the greeting friendlier");
  await page.getByTestId("assistant-send").click();

  const card = page.getByTestId("assistant-edit-card");
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card).toContainText("Hello there");
  await expect(prose).toContainText("Hello world");
  await expect(prose).not.toContainText("Hello there");

  await page.getByTestId("assistant-apply").click();
  await expect(prose).toContainText("Hello there");
  await expect(card).toHaveAttribute("data-status", "applied");
  await expect(page.getByTestId("assistant-message")).toContainText("I changed the greeting.", { timeout: 15_000 });
  await expect(page.getByTestId("assistant-cost")).toContainText("$0.0009");

  await prose.click();
  await page.keyboard.press("ControlOrMeta+Z");
  await expect(prose).toContainText("Hello world");
  await expect(prose).not.toContainText("Hello there");

  expect(requests[0]!.headers.authorization).toBe(`Bearer ${KEY}`);
  const provider = requests[0]!.body.provider as { data_collection?: string } | undefined;
  expect(provider?.data_collection).toBe("deny");
  const tools = (requests[0]!.body.tools as { function: { name: string } }[]).map((t) => t.function.name).sort();
  expect(tools).toEqual(["editFile", "listFiles", "readFile", "search"]);
  expect(JSON.stringify(requests[0]!.body.messages)).toContain("Make the greeting friendlier");
});

test("Discard leaves the document alone and tells the model", async ({ page }) => {
  await withKey(page);
  const requests = await mockOpenRouter(page, [
    toolCall("editFile", { path: "Untitled-1.md", edits: [{ oldText: "Hello world", newText: "Goodbye" }] }),
    text("Understood.")
  ]);
  const prose = await openAssistant(page);
  await prose.click();
  await page.keyboard.type("Hello world");
  await page.getByTestId("assistant-input").fill("Change it");
  await page.getByTestId("assistant-input").press("Enter");
  await expect(page.getByTestId("assistant-edit-card")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("assistant-discard").click();
  await expect(page.getByTestId("assistant-edit-card")).toHaveAttribute("data-status", "discarded");
  await expect(prose).toContainText("Hello world");
  await expect(page.getByTestId("assistant-message")).toContainText("Understood.", { timeout: 15_000 });
  expect(JSON.stringify(requests[1]!.body.messages)).toContain("declined");
});

test("an edit that no longer applies is refused and nothing is written", async ({ page }) => {
  await withKey(page);
  await mockOpenRouter(page, [
    toolCall("editFile", { path: "Untitled-1.md", edits: [{ oldText: "Hello world", newText: "Hi" }] }),
    text("Done.")
  ]);
  const prose = await openAssistant(page);
  await prose.click();
  await page.keyboard.type("Hello world");
  await page.getByTestId("assistant-input").fill("Shorten it");
  await page.getByTestId("assistant-input").press("Enter");
  await expect(page.getByTestId("assistant-edit-card")).toBeVisible({ timeout: 15_000 });
  // The user keeps typing while the card is open.
  await prose.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Something else entirely");
  await page.getByTestId("assistant-apply").click();
  await expect(page.getByTestId("assistant-edit-card")).toHaveAttribute("data-status", "stale");
  await expect(prose).toContainText("Something else entirely");
});

test("Stop ends a turn that is waiting on an edit", async ({ page }) => {
  await withKey(page);
  await mockOpenRouter(page, [
    toolCall("editFile", { path: "Untitled-1.md", edits: [{ oldText: "Hello world", newText: "Hi" }] })
  ]);
  const prose = await openAssistant(page);
  await prose.click();
  await page.keyboard.type("Hello world");
  await page.getByTestId("assistant-input").fill("Shorten it");
  await page.getByTestId("assistant-input").press("Enter");
  await expect(page.getByTestId("assistant-edit-card")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("assistant-stop").click();
  await expect(page.getByTestId("assistant-edit-card")).toHaveAttribute("data-status", "discarded");
  await expect(page.getByTestId("assistant-send")).toBeVisible();
  await expect(prose).toContainText("Hello world");
});

test("requests to other origins are not made by the assistant", async ({ page }) => {
  await withKey(page);
  const seen: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1") && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) {
      seen.push(new URL(r.url()).origin);
    }
  });
  await mockOpenRouter(page, [text("Hi")]);
  await openAssistant(page);
  await page.getByTestId("assistant-input").fill("Hello");
  await page.getByTestId("assistant-input").press("Enter");
  await expect(page.getByTestId("assistant-message")).toBeVisible({ timeout: 15_000 });
  expect(new Set(seen)).toEqual(new Set(["https://openrouter.ai"]));
});

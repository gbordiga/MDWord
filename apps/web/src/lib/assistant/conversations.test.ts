import { describe, expect, it } from "vitest";
import { dayGroup, filterConversations, parseIndex, serializeIndex, titleFromThread } from "./conversations";

describe("conversations", () => {
  it("titles a conversation from the first user message", () => {
    expect(titleFromThread([{ kind: "user", id: "u", text: "  Fix\nthe   intro " }])).toBe("Fix the intro");
    expect(titleFromThread([{ kind: "user", id: "u", text: "x".repeat(100) }]).length).toBe(60);
    expect(titleFromThread([])).toBe("");
  });

  it("round-trips the index and rejects garbage", () => {
    const index = { conversations: [{ id: "a", title: "A", updatedAt: 1 }, { id: "b", title: "B", updatedAt: 2 }], activeId: "a" };
    const back = parseIndex(serializeIndex(index));
    expect(back?.activeId).toBe("a");
    expect(back?.conversations.map((c) => c.id)).toEqual(["b", "a"]);
    expect(parseIndex("nope")).toBeNull();
    expect(parseIndex(null)).toBeNull();
  });

  it("groups by day and filters by title", () => {
    const now = new Date(2026, 10, 8, 12).getTime();
    expect(dayGroup(new Date(2026, 10, 8, 1).getTime(), now)).toBe("today");
    expect(dayGroup(new Date(2026, 10, 7, 23).getTime(), now)).toBe("yesterday");
    expect(dayGroup(new Date(2026, 10, 4).getTime(), now)).toBe("week");
    expect(dayGroup(new Date(2026, 9, 1).getTime(), now)).toBe("older");
    const list = [{ id: "a", title: "Intro rewrite", updatedAt: 1 }, { id: "b", title: "Tables", updatedAt: 2 }];
    expect(filterConversations(list, "intro").map((c) => c.id)).toEqual(["a"]);
    expect(filterConversations(list, "").map((c) => c.id)).toEqual(["b", "a"]);
  });
});

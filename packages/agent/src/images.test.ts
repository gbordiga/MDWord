import { describe, expect, it } from "vitest";
import { imageGenerationRequest, parseGeneratedImage } from "./images";

describe("image generation", () => {
  it("asks OpenRouter for an image and keeps the privacy routing", () => {
    const request = imageGenerationRequest({
      model: "google/gemini-2.5-flash-image",
      prompt: "a red circle",
      privacyOnly: true,
      zdrOnly: true
    });
    expect(request.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(request.body).toMatchObject({
      model: "google/gemini-2.5-flash-image",
      modalities: ["image", "text"],
      provider: { data_collection: "deny", zdr: true }
    });
  });

  it("reads an image from either response shape and ignores text", () => {
    const url = "data:image/png;base64,AAAA";
    expect(parseGeneratedImage({ choices: [{ message: { images: [{ image_url: { url } }] } }], usage: { cost: 0.02 } })).toEqual({
      dataUrl: url,
      costUsd: 0.02
    });
    expect(parseGeneratedImage({ choices: [{ message: { content: [{ type: "image_url", image_url: { url } }] } }] })).toMatchObject({
      dataUrl: url
    });
    expect(parseGeneratedImage({ error: { message: "no credits" } })).toEqual({ error: "no credits" });
    expect(parseGeneratedImage({ choices: [{ message: { content: "nope" } }] })).toMatchObject({ error: expect.any(String) });
  });
});
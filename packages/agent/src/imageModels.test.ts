import { describe, expect, it } from "vitest";
import {
  imageModels,
  imageModelsListUrl,
  imagePriceLabel,
  imagePriceLevel,
  isImageOnly,
  parseModelList,
  typicalImageCost
} from "./models";
import { imageGenerationRequest } from "./images";

const raw = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id,
  created: 1,
  pricing: { prompt: "0", completion: "0" },
  ...extra
});

describe("image models", () => {
  it("asks OpenRouter for picture models, with zero data retention when on", () => {
    expect(imageModelsListUrl(false)).toBe("https://openrouter.ai/api/v1/models?output_modalities=image");
    expect(imageModelsListUrl(true)).toBe("https://openrouter.ai/api/v1/models?output_modalities=image&zdr=true");
  });

  it("reads output modalities and the image token price, not the input image price", () => {
    const [model] = parseModelList({
      data: [
        raw("google/gemini-2.5-flash-image", {
          architecture: { output_modalities: ["image", "text"] },
          pricing: { prompt: "0.0000003", completion: "0.0000025", image: "0.0000003", image_output: "0.00003" }
        })
      ]
    });
    expect(model!.outputModalities).toEqual(["image", "text"]);
    expect(model!.imageTokenPrice).toBe(0.00003);
    expect(typicalImageCost(model!)).toBeCloseTo(0.039, 3);
    expect(imagePriceLabel(model!)).toBe("~$0.039 / image");
  });

  it("keeps the newest picture models and drops text-only and expired ones", () => {
    const models = parseModelList({
      data: [
        raw("a/old", { created: 1, architecture: { output_modalities: ["image"] } }),
        raw("a/new", { created: 9, architecture: { output_modalities: ["image"] } }),
        raw("a/text", { created: 5, architecture: { output_modalities: ["text"] } }),
        raw("a/gone", { created: 7, architecture: { output_modalities: ["image"] }, expiration_date: "2000-01-01" })
      ]
    });
    expect(imageModels(models).map((m) => m.id)).toEqual(["a/new", "a/old"]);
  });

  it("scales cost from 1 to 5 per picture, and shows nothing when the price is unknown", () => {
    const at = (usd: number) => ({ imageTokenPrice: usd / 1300 });
    expect(imagePriceLevel(at(0.005))).toBe(1);
    expect(imagePriceLevel(at(0.02))).toBe(2);
    expect(imagePriceLevel(at(0.04))).toBe(3);
    expect(imagePriceLevel(at(0.1))).toBe(4);
    expect(imagePriceLevel(at(0.2))).toBe(5);
    expect(imagePriceLevel({ imageTokenPrice: 0 })).toBeNull();
    expect(imagePriceLabel({ imageTokenPrice: 0 })).toBe("");
  });

  it("asks for pictures only from a model that returns nothing else", () => {
    expect(isImageOnly({ outputModalities: ["image"] })).toBe(true);
    expect(isImageOnly({ outputModalities: ["image", "text"] })).toBe(false);
    expect(isImageOnly(undefined)).toBe(false);
    const base = { model: "m", prompt: "p", privacyOnly: false, zdrOnly: false };
    expect(imageGenerationRequest({ ...base, imageOnly: true }).body.modalities).toEqual(["image"]);
    expect(imageGenerationRequest(base).body.modalities).toEqual(["image", "text"]);
  });
});

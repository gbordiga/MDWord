"use client";

import { useEffect, useMemo } from "react";
import { DEFAULT_IMAGE_MODEL_ID, latestModels, type ModelInfo } from "@mdword/agent";
import { useAssistant } from "@/lib/assistant/store";

/** Stand-in row for a picture model whose details could not be loaded. */
export function plainImageModel(id: string): ModelInfo {
  return {
    id,
    name: id,
    contextLength: 0,
    promptPrice: 0,
    completionPrice: 0,
    supportsTools: false,
    expired: false,
    intelligence: null,
    intelligenceEstimated: false,
    codingIndex: null,
    agenticIndex: null,
    created: 0,
    outputModalities: ["image", "text"],
    imageTokenPrice: 0
  };
}

/**
 * The model lists both pickers show. While `enabled`, loads the text and the
 * picture lists once a key exists; they reload when the privacy filter changes.
 */
export function useModelLists(enabled = true) {
  const models = useAssistant((s) => s.models);
  const modelsFailed = useAssistant((s) => s.modelsFailed);
  const imageModels = useAssistant((s) => s.imageModels);
  const imageModelsFailed = useAssistant((s) => s.imageModelsFailed);
  const usableSuggested = useAssistant((s) => s.usableSuggested);
  const loadModels = useAssistant((s) => s.loadModels);
  const loadImageModels = useAssistant((s) => s.loadImageModels);
  const hasKey = useAssistant((s) => s.key?.hasKey ?? false);
  const zdrOnly = useAssistant((s) => s.settings.zdrOnly);
  const current = useAssistant((s) => s.settings.modelId);
  const currentImage = useAssistant((s) => s.settings.imageModelId);

  useEffect(() => {
    if (enabled && hasKey && models == null && !modelsFailed) void loadModels();
  }, [enabled, hasKey, models, modelsFailed, zdrOnly, loadModels]);

  useEffect(() => {
    if (enabled && hasKey && imageModels == null && !imageModelsFailed) void loadImageModels();
  }, [enabled, hasKey, imageModels, imageModelsFailed, zdrOnly, loadImageModels]);

  const suggestedIds = useMemo(() => new Set(usableSuggested.map((m) => m.id)), [usableSuggested]);
  const others = useMemo(
    () =>
      latestModels(models ?? [], new Set([current]))
        .filter((m) => m.supportsTools && !m.expired && !suggestedIds.has(m.id))
        .sort((a, b) => a.id.localeCompare(b.id)),
    [models, suggestedIds, current]
  );
  const imageList = useMemo(() => {
    if (imageModels) return imageModels;
    // The list could not be loaded: keep the chosen model and the default usable.
    return [...new Set([currentImage, DEFAULT_IMAGE_MODEL_ID])].map(plainImageModel);
  }, [imageModels, currentImage]);

  return { models, modelsFailed, suggested: usableSuggested, others, imageList, imageModelsFailed, current, currentImage };
}

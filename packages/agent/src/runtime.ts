/**
 * The parts that pull in the AI SDK and the OpenRouter provider. Import them
 * lazily (`await import("@mdword/agent/runtime")`) so they stay out of the
 * initial bundle.
 */
export * from "./loop";
export * from "./openrouter";
export * from "./tools";

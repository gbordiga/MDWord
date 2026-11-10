#!/usr/bin/env node
// Checks packages/agent/src/suggested-models.json against OpenRouter's public API.
// Fails when the default model is invalid. Warns about everything else.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const list = JSON.parse(readFileSync(path.join(here, "../packages/agent/src/suggested-models.json"), "utf8"));
const COST_CAP = { low: 0.005, balanced: 0.04, quality: Infinity };
// Typical turn: 18K input tokens, 1.5K output tokens, plus 2K hidden reasoning when mandatory.
const turnCost = (m, reasoning) =>
  18_000 * Number(m.pricing?.prompt ?? 0) + (1_500 + (reasoning === "mandatory" ? 2_000 : 0)) * Number(m.pricing?.completion ?? 0);

const response = await fetch("https://openrouter.ai/api/v1/models");
if (!response.ok) {
  console.error(`Could not read the OpenRouter model list (${response.status}).`);
  process.exit(2);
}
const live = new Map((await response.json()).data.map((m) => [m.id, m]));

// Every suggested model must have a zero-data-retention endpoint, because the list is meant to work with the ZDR setting on.
const zdrResponse = await fetch("https://openrouter.ai/api/v1/models?zdr=true");
if (!zdrResponse.ok) {
  console.error(`Could not read the ZDR model list (${zdrResponse.status}).`);
  process.exit(2);
}
const zdr = new Set((await zdrResponse.json()).data.map((m) => m.id));

const warnings = [];
let defaultProblem = null;
for (const entry of list.models) {
  const model = live.get(entry.id);
  const problems = [];
  if (!model) problems.push("not in the live model list");
  else {
    if (!(model.supported_parameters ?? []).includes("tools")) problems.push("no tool calling");
    if (!zdr.has(entry.id)) problems.push("no zero-data-retention endpoint");
    if (model.expiration_date && Date.parse(model.expiration_date) <= Date.now()) problems.push("expired");
    const cost = turnCost(model, entry.reasoning);
    if (cost > COST_CAP[entry.tier]) problems.push(`estimated cost per turn $${cost.toFixed(4)} breaks the ${entry.tier} tier cap`);
    if (entry.tier === "low" && entry.reasoning === "mandatory") problems.push("mandatory reasoning in the low tier");
    try {
      const r = await fetch(`https://openrouter.ai/api/v1/models/${entry.id}/endpoints`);
      if (r.ok) {
        const endpoints = (await r.json()).data?.endpoints ?? [];
        if (endpoints.length === 0) problems.push("no provider endpoints");
      }
    } catch {
      /* the endpoints check is best effort */
    }
  }
  if (problems.length > 0) {
    warnings.push(`${entry.id}: ${problems.join("; ")}`);
    if (entry.id === list.default) defaultProblem = problems.join("; ");
  }
}
if (!list.models.some((m) => m.id === list.default)) defaultProblem = "the default is not in the suggested list";

for (const w of warnings) console.warn(`warning: ${w}`);
if (defaultProblem) {
  console.error(`error: default model ${list.default}: ${defaultProblem}`);
  process.exit(1);
}
console.log(`ok: default ${list.default} is valid; ${list.models.length - warnings.length}/${list.models.length} suggested models pass.`);

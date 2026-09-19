import { JourneySchema, type Journey, type StepDefinition } from "./schema";

export function createEmptyJourney(name = "New Guided Journey", startUrl = "https://"): Journey {
  const now = new Date().toISOString();
  let origin = startUrl;
  try {
    origin = new URL(startUrl).origin;
  } catch {
    origin = startUrl;
  }

  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name,
    description: "",
    allowedOrigins: [origin],
    startUrl,
    steps: [],
    createdAt: now,
    updatedAt: now
  };
}

export function createDefaultStep(order = 0): StepDefinition {
  return {
    id: crypto.randomUUID(),
    order,
    title: `Step ${order + 1}`,
    instruction: "Follow this step on the page.",
    action: "click",
    timeoutMs: 30000,
    allowSkip: false
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  journey?: Journey;
}

export function validateJourney(data: unknown): ValidationResult {
  const result = JourneySchema.safeParse(data);
  if (result.success) {
    return { valid: true, errors: [], journey: result.data };
  }
  const errors = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
  return { valid: false, errors };
}

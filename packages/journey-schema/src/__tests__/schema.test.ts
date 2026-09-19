import { describe, it, expect } from "vitest";
import { JourneySchema } from "../schema";
import { createEmptyJourney, createDefaultStep, validateJourney } from "../helpers";

describe("JourneySchema", () => {
  it("validates a well-formed journey definition", () => {
    const valid = {
      schemaVersion: 1,
      id: "11111111-1111-4111-8111-111111111111",
      name: "Demo Walkthrough",
      startUrl: "https://demo.example.com/app",
      allowedOrigins: ["https://demo.example.com"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          order: 0,
          title: "Navigate to Dashboard",
          instruction: "Welcome to Acme! Start by reviewing your metrics.",
          action: "manual",
          timeoutMs: 30000,
          allowSkip: false
        }
      ]
    };

    const parsed = JourneySchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("rejects an invalid action type", () => {
    const invalid = {
      schemaVersion: 1,
      id: "11111111-1111-4111-8111-111111111111",
      name: "Bad Journey",
      startUrl: "https://demo.example.com",
      allowedOrigins: ["https://demo.example.com"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          order: 0,
          title: "Arbitrary action",
          instruction: "Testing invalid action",
          action: "execute-arbitrary-script" // not permitted!
        }
      ]
    };

    const parsed = JourneySchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it("creates a well-formed empty journey with default values", () => {
    const empty = createEmptyJourney("Test Onboarding", "https://app.example.com/welcome");
    expect(empty.name).toBe("Test Onboarding");
    expect(empty.allowedOrigins).toEqual(["https://app.example.com"]);
    expect(empty.schemaVersion).toBe(1);
    expect(empty.steps).toEqual([]);
  });

  it("validates journey correctly with validateJourney helper", () => {
    const journey = createEmptyJourney("Valid Flow", "https://demo.example.com");
    journey.steps.push(createDefaultStep(0));

    const result = validateJourney(journey);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

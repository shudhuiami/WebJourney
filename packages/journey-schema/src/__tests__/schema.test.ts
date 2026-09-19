import { describe, it, expect } from "vitest";
import { JourneySchema } from "../schema";

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
});

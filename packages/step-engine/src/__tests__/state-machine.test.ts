import { describe, it, expect } from "vitest";
import { playerReducer, initialPlayerContext } from "../state-machine";
import type { Journey } from "@webjourney/journey-schema";

const mockJourney: Journey = {
  schemaVersion: 1,
  id: "11111111-1111-4111-8111-111111111111",
  name: "Onboarding Flow",
  startUrl: "https://demo.example.com",
  allowedOrigins: ["https://demo.example.com"],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  steps: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      order: 0,
      title: "Click Create Project",
      instruction: "Click the primary button to open dialog",
      action: "click",
      target: {
        selectorCandidates: ["#action-open-modal"],
        tagName: "button"
      },
      timeoutMs: 15000,
      allowSkip: false
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      order: 1,
      title: "Fill in Project Name",
      instruction: "Type your desired project name",
      action: "field-complete",
      target: {
        selectorCandidates: ["#project-name-input"],
        tagName: "input"
      },
      timeoutMs: 15000,
      allowSkip: true
    }
  ]
};

describe("playerReducer", () => {
  it("transitions from idle to resolving on START", () => {
    const next = playerReducer(initialPlayerContext, {
      type: "START",
      journey: mockJourney
    });

    expect(next.state).toBe("resolving");
    expect(next.currentStepIndex).toBe(0);
    expect(next.journey).toBe(mockJourney);
  });

  it("transitions from resolving to active on TARGET_RESOLVED", () => {
    const resolving = playerReducer(initialPlayerContext, {
      type: "START",
      journey: mockJourney
    });

    const active = playerReducer(resolving, {
      type: "TARGET_RESOLVED",
      selector: "#action-open-modal"
    });

    expect(active.state).toBe("active");
    expect(active.matchedElementSelector).toBe("#action-open-modal");
  });

  it("blocks when target is not found", () => {
    const resolving = playerReducer(initialPlayerContext, {
      type: "START",
      journey: mockJourney
    });

    const blocked = playerReducer(resolving, {
      type: "TARGET_NOT_FOUND",
      error: "Element missing from DOM"
    });

    expect(blocked.state).toBe("blocked");
    expect(blocked.blockReason).toBe("target_not_found");
  });

  it("advances to next step and enters resolving state", () => {
    const resolving = playerReducer(initialPlayerContext, {
      type: "START",
      journey: mockJourney
    });
    const next = playerReducer(resolving, { type: "NEXT_STEP" });

    expect(next.currentStepIndex).toBe(1);
    expect(next.state).toBe("resolving");
  });

  it("completes journey when final step advances", () => {
    let state = playerReducer(initialPlayerContext, {
      type: "START",
      journey: mockJourney
    });
    state = playerReducer(state, { type: "NEXT_STEP" }); // at step 1
    state = playerReducer(state, { type: "NEXT_STEP" }); // advances past end

    expect(state.state).toBe("completed");
  });
});

// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { JourneyPlayer } from "../player";
import type { Journey } from "@webjourney/journey-schema";

const mockTestJourney: Journey = {
  schemaVersion: 1,
  id: "aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Player Test Journey",
  startUrl: "https://demo.example.com",
  allowedOrigins: ["https://demo.example.com"],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  steps: [
    {
      id: "step-1",
      order: 0,
      title: "First Click Step",
      instruction: "Click the test button",
      action: "click",
      target: {
        selectorCandidates: ["#test-btn-1"],
        tagName: "button"
      },
      timeoutMs: 5000,
      allowSkip: true
    },
    {
      id: "step-2",
      order: 1,
      title: "Second Step",
      instruction: "Manual continue step",
      action: "manual",
      timeoutMs: 5000,
      allowSkip: false
    },
    {
      id: "step-3",
      order: 2,
      title: "Cross Page Route Step",
      instruction: "Review services overview",
      action: "click",
      urlMatcher: {
        path: "/services"
      },
      target: {
        selectorCandidates: ["#services-header"],
        tagName: "h1"
      },
      timeoutMs: 5000,
      allowSkip: true
    }
  ]
};

describe("JourneyPlayer", () => {
  it("resolves target and triggers highlight on start", () => {
    const btn = document.createElement("button");
    btn.id = "test-btn-1";
    document.body.appendChild(btn);

    const onStateChange = vi.fn();
    const onHighlightTarget = vi.fn();
    const onClearHighlight = vi.fn();

    const player = new JourneyPlayer({
      onStateChange,
      onHighlightTarget,
      onClearHighlight
    });

    player.start(mockTestJourney);

    expect(player.getState()).toBe("active");
    expect(onHighlightTarget).toHaveBeenCalledWith(btn, mockTestJourney.steps[0]);

    document.body.removeChild(btn);
  });

  it("can resume at a specific step index for persistent recovery", () => {
    const onStateChange = vi.fn();
    const onHighlightTarget = vi.fn();
    const onClearHighlight = vi.fn();

    const player = new JourneyPlayer({
      onStateChange,
      onHighlightTarget,
      onClearHighlight
    });

    // Start with resumeStepIndex = 1 (step-2: manual)
    player.start(mockTestJourney, 1);

    expect(player.getContext().currentStepIndex).toBe(1);
    expect(player.getState()).toBe("active");
  });

  it("triggers URL_MISMATCH and blocks gracefully when step expects a different route", () => {
    const onStateChange = vi.fn();
    const onHighlightTarget = vi.fn();
    const onClearHighlight = vi.fn();

    const player = new JourneyPlayer({
      onStateChange,
      onHighlightTarget,
      onClearHighlight
    });

    // Start directly on step 2 which expects /services
    player.start(mockTestJourney, 2);

    expect(player.getState()).toBe("blocked");
    expect(player.getContext().blockReason).toBe("url_mismatch");
    expect(player.getContext().expectedUrl).toBe("/services");
  });

  it("can pause and resume playback cleanly", () => {
    const onStateChange = vi.fn();
    const onHighlightTarget = vi.fn();
    const onClearHighlight = vi.fn();

    const player = new JourneyPlayer({
      onStateChange,
      onHighlightTarget,
      onClearHighlight
    });

    player.start(mockTestJourney);
    player.pause();
    expect(player.getState()).toBe("paused");
    expect(onClearHighlight).toHaveBeenCalled();
  });

  it("advances to next step and finishes when reaching end", () => {
    const onStateChange = vi.fn();
    const onHighlightTarget = vi.fn();
    const onClearHighlight = vi.fn();

    const player = new JourneyPlayer({
      onStateChange,
      onHighlightTarget,
      onClearHighlight
    });

    player.start(mockTestJourney);
    player.nextStep(); // to step 1
    expect(player.getContext().currentStepIndex).toBe(1);

    player.nextStep(); // to step 2
    expect(player.getContext().currentStepIndex).toBe(2);

    player.skipStep(); // completes (step 2 has allowSkip: true)
    expect(player.getState()).toBe("completed");
  });
});

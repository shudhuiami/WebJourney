import { describe, it, expect } from "vitest";
import {
  aggregateAnalyticsEvents,
  AnalyticsEventSchema,
  type AnalyticsEvent
} from "../analytics";

describe("analytics - Telemetry & Funnel Aggregation", () => {
  it("validates well-formed analytics events", () => {
    const validEvent: AnalyticsEvent = {
      id: "ev-1",
      journeyId: "j-1",
      journeyName: "Demo Tour",
      eventType: "step_view",
      stepId: "step-1",
      stepTitle: "Welcome",
      stepOrder: 0,
      timestamp: Date.now()
    };

    const parsed = AnalyticsEventSchema.safeParse(validEvent);
    expect(parsed.success).toBe(true);
  });

  it("accurately computes funnels, drop-offs, and completion rates", () => {
    const now = Date.now();
    const events: AnalyticsEvent[] = [
      // Learner 1: Completes whole tour (step 1 -> step 2 -> complete)
      { id: "1", journeyId: "j-1", journeyName: "Test Tour", eventType: "journey_start", timestamp: now },
      { id: "2", journeyId: "j-1", journeyName: "Test Tour", eventType: "step_view", stepId: "s-1", stepTitle: "Step 1", stepOrder: 0, timestamp: now },
      { id: "3", journeyId: "j-1", journeyName: "Test Tour", eventType: "step_complete", stepId: "s-1", stepTitle: "Step 1", stepOrder: 0, durationMs: 4000, timestamp: now + 4000 },
      { id: "4", journeyId: "j-1", journeyName: "Test Tour", eventType: "step_view", stepId: "s-2", stepTitle: "Step 2", stepOrder: 1, timestamp: now + 4000 },
      { id: "5", journeyId: "j-1", journeyName: "Test Tour", eventType: "step_complete", stepId: "s-2", stepTitle: "Step 2", stepOrder: 1, durationMs: 6000, timestamp: now + 10000 },
      { id: "6", journeyId: "j-1", journeyName: "Test Tour", eventType: "journey_complete", durationMs: 10000, timestamp: now + 10000 },

      // Learner 2: Drops off at Step 2 (exits tour)
      { id: "7", journeyId: "j-1", journeyName: "Test Tour", eventType: "journey_start", timestamp: now + 11000 },
      { id: "8", journeyId: "j-1", journeyName: "Test Tour", eventType: "step_view", stepId: "s-1", stepTitle: "Step 1", stepOrder: 0, timestamp: now + 11000 },
      { id: "9", journeyId: "j-1", journeyName: "Test Tour", eventType: "step_complete", stepId: "s-1", stepTitle: "Step 1", stepOrder: 0, durationMs: 3000, timestamp: now + 14000 },
      { id: "10", journeyId: "j-1", journeyName: "Test Tour", eventType: "step_view", stepId: "s-2", stepTitle: "Step 2", stepOrder: 1, timestamp: now + 14000 },
      { id: "11", journeyId: "j-1", journeyName: "Test Tour", eventType: "step_exit", stepId: "s-2", stepTitle: "Step 2", stepOrder: 1, durationMs: 2000, timestamp: now + 16000 }
    ];

    const summaries = aggregateAnalyticsEvents(events);
    const tourSummary = summaries["j-1"];

    expect(tourSummary).toBeDefined();
    expect(tourSummary.totalStarts).toBe(2);
    expect(tourSummary.totalCompletions).toBe(1);
    expect(tourSummary.completionRate).toBe(50);
    expect(tourSummary.avgCompletionTimeSec).toBe(10);

    // Step 1: 2 views, 2 completions, 0 exits, 0% drop-off
    const step1 = tourSummary.steps[0];
    expect(step1.views).toBe(2);
    expect(step1.completions).toBe(2);
    expect(step1.dropOffCount).toBe(0);
    expect(step1.dropOffRate).toBe(0);

    // Step 2: 2 views, 1 completion, 1 exit, 50% drop-off
    const step2 = tourSummary.steps[1];
    expect(step2.views).toBe(2);
    expect(step2.completions).toBe(1);
    expect(step2.exits).toBe(1);
    expect(step2.dropOffCount).toBe(1);
    expect(step2.dropOffRate).toBe(50);

    // Most dropped step is Step 2
    expect(tourSummary.mostDroppedStep?.stepOrder).toBe(1);
    expect(tourSummary.mostDroppedStep?.stepTitle).toBe("Step 2");
    expect(tourSummary.mostDroppedStep?.dropOffRate).toBe(50);
  });
});

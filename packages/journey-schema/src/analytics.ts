import { z } from "zod";

export const AnalyticsEventTypeSchema = z.enum([
  "journey_start",
  "journey_complete",
  "step_view",
  "step_complete",
  "step_skip",
  "step_exit"
]);
export type AnalyticsEventType = z.infer<typeof AnalyticsEventTypeSchema>;

export const AnalyticsEventSchema = z.object({
  id: z.string(),
  journeyId: z.string(),
  journeyName: z.string(),
  eventType: AnalyticsEventTypeSchema,
  stepId: z.string().optional(),
  stepTitle: z.string().optional(),
  stepOrder: z.number().int().nonnegative().optional(),
  durationMs: z.number().nonnegative().optional(),
  timestamp: z.number().positive()
});
export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;

export interface StepAnalyticsSummary {
  stepId: string;
  stepTitle: string;
  stepOrder: number;
  views: number;
  completions: number;
  skips: number;
  exits: number;
  dropOffCount: number;
  dropOffRate: number; // percentage 0 - 100
  avgDurationSec: number;
}

export interface JourneyAnalyticsSummary {
  journeyId: string;
  journeyName: string;
  totalStarts: number;
  totalCompletions: number;
  completionRate: number; // percentage 0 - 100
  avgCompletionTimeSec: number;
  steps: StepAnalyticsSummary[];
  mostDroppedStep?: {
    stepOrder: number;
    stepTitle: string;
    dropOffRate: number;
  };
}

/**
 * Aggregates a stream of raw telemetry events into structured journey summaries and funnel statistics.
 */
export function aggregateAnalyticsEvents(
  events: AnalyticsEvent[],
  filterJourneyId?: string
): Record<string, JourneyAnalyticsSummary> {
  const filtered = filterJourneyId
    ? events.filter((e) => e.journeyId === filterJourneyId)
    : events;

  const grouped: Record<string, AnalyticsEvent[]> = {};
  for (const ev of filtered) {
    if (!grouped[ev.journeyId]) {
      grouped[ev.journeyId] = [];
    }
    grouped[ev.journeyId].push(ev);
  }

  const summaries: Record<string, JourneyAnalyticsSummary> = {};

  for (const [jId, jEvents] of Object.entries(grouped)) {
    const journeyName = jEvents[0]?.journeyName || "Unknown Tour";
    const starts = jEvents.filter((e) => e.eventType === "journey_start");
    const completions = jEvents.filter((e) => e.eventType === "journey_complete");

    const totalStarts = starts.length;
    const totalCompletions = completions.length;
    const completionRate = totalStarts > 0 ? Math.round((totalCompletions / totalStarts) * 100) : 0;

    const completionDurations = completions
      .map((c) => c.durationMs || 0)
      .filter((d) => d > 0);
    const avgCompletionTimeSec =
      completionDurations.length > 0
        ? Math.round(
            completionDurations.reduce((sum, d) => sum + d, 0) /
              completionDurations.length /
              1000
          )
        : 0;

    // Aggregate step metrics
    const stepMap = new Map<string, {
      stepId: string;
      stepTitle: string;
      stepOrder: number;
      views: number;
      completions: number;
      skips: number;
      exits: number;
      durations: number[];
    }>();

    for (const ev of jEvents) {
      if (ev.stepId) {
        if (!stepMap.has(ev.stepId)) {
          stepMap.set(ev.stepId, {
            stepId: ev.stepId,
            stepTitle: ev.stepTitle || `Step ${(ev.stepOrder ?? 0) + 1}`,
            stepOrder: ev.stepOrder ?? 0,
            views: 0,
            completions: 0,
            skips: 0,
            exits: 0,
            durations: []
          });
        }
        const s = stepMap.get(ev.stepId)!;
        if (ev.stepTitle && s.stepTitle.startsWith("Step ")) {
          s.stepTitle = ev.stepTitle;
        }
        if (ev.stepOrder !== undefined) {
          s.stepOrder = ev.stepOrder;
        }

        if (ev.eventType === "step_view") {
          s.views += 1;
        } else if (ev.eventType === "step_complete") {
          s.completions += 1;
          if (ev.durationMs) s.durations.push(ev.durationMs);
        } else if (ev.eventType === "step_skip") {
          s.skips += 1;
          if (ev.durationMs) s.durations.push(ev.durationMs);
        } else if (ev.eventType === "step_exit") {
          s.exits += 1;
          if (ev.durationMs) s.durations.push(ev.durationMs);
        }
      }
    }

    const sortedSteps = Array.from(stepMap.values()).sort(
      (a, b) => a.stepOrder - b.stepOrder
    );

    const stepSummaries: StepAnalyticsSummary[] = sortedSteps.map((s) => {
      // Drop-offs: exits plus learners who viewed but neither completed nor skipped
      const dropOffCount = s.exits + Math.max(0, s.views - (s.completions + s.skips + s.exits));
      const dropOffRate = s.views > 0 ? Math.round((dropOffCount / s.views) * 100) : 0;
      const avgDurationSec =
        s.durations.length > 0
          ? Math.round(
              (s.durations.reduce((a, b) => a + b, 0) / s.durations.length / 1000) * 10
            ) / 10
          : 0;

      return {
        stepId: s.stepId,
        stepTitle: s.stepTitle,
        stepOrder: s.stepOrder,
        views: s.views,
        completions: s.completions,
        skips: s.skips,
        exits: s.exits,
        dropOffCount,
        dropOffRate,
        avgDurationSec
      };
    });

    // Identify most dropped step
    let mostDroppedStep: JourneyAnalyticsSummary["mostDroppedStep"] = undefined;
    const candidates = stepSummaries.filter((s) => s.views > 0 && s.dropOffCount > 0);
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.dropOffRate - a.dropOffRate);
      mostDroppedStep = {
        stepOrder: candidates[0].stepOrder,
        stepTitle: candidates[0].stepTitle,
        dropOffRate: candidates[0].dropOffRate
      };
    }

    summaries[jId] = {
      journeyId: jId,
      journeyName,
      totalStarts,
      totalCompletions,
      completionRate,
      avgCompletionTimeSec,
      steps: stepSummaries,
      mostDroppedStep
    };
  }

  return summaries;
}

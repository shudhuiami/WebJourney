import type { PlayerContext, PlayerEvent } from "./types";

export const initialPlayerContext: PlayerContext = {
  journey: null,
  currentStepIndex: 0,
  state: "idle"
};

export function playerReducer(context: PlayerContext, event: PlayerEvent): PlayerContext {
  switch (event.type) {
    case "START":
      return {
        ...context,
        journey: event.journey,
        currentStepIndex:
          event.startStepIndex !== undefined &&
          event.startStepIndex >= 0 &&
          event.startStepIndex < event.journey.steps.length
            ? event.startStepIndex
            : 0,
        state: "resolving",
        blockReason: undefined,
        errorMessage: undefined,
        expectedUrl: undefined,
        targetUrl: undefined,
        stepStartTime: Date.now()
      };

    case "TARGET_RESOLVED":
      return {
        ...context,
        state: "active",
        matchedElementSelector: event.selector,
        blockReason: undefined,
        errorMessage: undefined,
        expectedUrl: undefined,
        targetUrl: undefined
      };

    case "TARGET_NOT_FOUND":
      return {
        ...context,
        state: "blocked",
        blockReason: "target_not_found",
        errorMessage: event.error || "Could not locate target element on current page"
      };

    case "TARGET_AMBIGUOUS":
      return {
        ...context,
        state: "blocked",
        blockReason: "target_ambiguous",
        errorMessage: `Found ${event.count} matching elements; unable to determine precise target`
      };

    case "URL_MISMATCH":
      return {
        ...context,
        state: "blocked",
        blockReason: "url_mismatch",
        errorMessage: `This step takes place on: ${event.expected}`,
        expectedUrl: event.expected,
        targetUrl: event.targetUrl
      };

    case "ACTION_PERFORMED":
      return {
        ...context,
        state: "verifying"
      };

    case "ACTION_VERIFIED":
    case "NEXT_STEP": {
      if (!context.journey) return context;
      const nextIndex = context.currentStepIndex + 1;
      if (nextIndex >= context.journey.steps.length) {
        return {
          ...context,
          state: "completed"
        };
      }
      return {
        ...context,
        currentStepIndex: nextIndex,
        state: "resolving",
        matchedElementSelector: undefined,
        blockReason: undefined,
        errorMessage: undefined,
        expectedUrl: undefined,
        targetUrl: undefined,
        stepStartTime: Date.now()
      };
    }

    case "PREVIOUS_STEP": {
      if (!context.journey || context.currentStepIndex <= 0) return context;
      return {
        ...context,
        currentStepIndex: context.currentStepIndex - 1,
        state: "resolving",
        matchedElementSelector: undefined,
        blockReason: undefined,
        errorMessage: undefined,
        expectedUrl: undefined,
        targetUrl: undefined,
        stepStartTime: Date.now()
      };
    }

    case "SKIP_STEP": {
      if (!context.journey) return context;
      const currentStep = context.journey.steps[context.currentStepIndex];
      if (!currentStep?.allowSkip) {
        return context;
      }
      const nextIndex = context.currentStepIndex + 1;
      if (nextIndex >= context.journey.steps.length) {
        return {
          ...context,
          state: "completed"
        };
      }
      return {
        ...context,
        currentStepIndex: nextIndex,
        state: "resolving",
        matchedElementSelector: undefined,
        blockReason: undefined,
        errorMessage: undefined,
        expectedUrl: undefined,
        targetUrl: undefined,
        stepStartTime: Date.now()
      };
    }

    case "RETRY_STEP":
      return {
        ...context,
        state: "resolving",
        blockReason: undefined,
        errorMessage: undefined,
        stepStartTime: Date.now()
      };

    case "PAUSE":
      if (context.state === "idle" || context.state === "completed") return context;
      return {
        ...context,
        state: "paused"
      };

    case "RESUME":
      if (context.state !== "paused") return context;
      return {
        ...context,
        state: "resolving"
      };

    case "STOP":
      return {
        ...initialPlayerContext
      };

    default:
      return context;
  }
}

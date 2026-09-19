import type { Journey, StepDefinition } from "@webjourney/journey-schema";
import { playerReducer, initialPlayerContext } from "./state-machine";
import { resolveTargetElement } from "./fingerprint";
import { observeTargetClick, observeFieldCompletion, observeUrlNavigation, type ObserverCleanup } from "./observers";
import type { PlayerContext, PlayerState } from "./types";

export interface PlayerCallbacks {
  onStateChange: (context: PlayerContext) => void;
  onHighlightTarget: (element: Element, step: StepDefinition) => void;
  onClearHighlight: () => void;
}

export class JourneyPlayer {
  private context: PlayerContext = initialPlayerContext;
  private callbacks: PlayerCallbacks;
  private activeCleanup: ObserverCleanup | null = null;
  private resolveTimer: any = null;

  constructor(callbacks: PlayerCallbacks) {
    this.callbacks = callbacks;
  }

  public getContext(): PlayerContext {
    return this.context;
  }

  public getState(): PlayerState {
    return this.context.state;
  }

  public start(journey: Journey, resumeStepIndex = 0) {
    this.cleanupCurrentStep();
    this.context = playerReducer(initialPlayerContext, { type: "START", journey });
    if (resumeStepIndex > 0 && resumeStepIndex < journey.steps.length) {
      this.context.currentStepIndex = resumeStepIndex;
    }
    this.callbacks.onStateChange(this.context);
    this.executeCurrentStep();
  }

  public pause() {
    this.cleanupCurrentStep();
    this.context = playerReducer(this.context, { type: "PAUSE" });
    this.callbacks.onClearHighlight();
    this.callbacks.onStateChange(this.context);
  }

  public resume() {
    if (this.context.state !== "paused") return;
    this.context = playerReducer(this.context, { type: "RESUME" });
    this.callbacks.onStateChange(this.context);
    this.executeCurrentStep();
  }

  public nextStep() {
    this.cleanupCurrentStep();
    this.context = playerReducer(this.context, { type: "NEXT_STEP" });
    this.callbacks.onStateChange(this.context);

    if (this.context.state === "completed") {
      this.callbacks.onClearHighlight();
    } else {
      this.executeCurrentStep();
    }
  }

  public previousStep() {
    if (this.context.currentStepIndex <= 0) return;
    this.cleanupCurrentStep();
    this.context = playerReducer(this.context, { type: "PREVIOUS_STEP" });
    this.callbacks.onStateChange(this.context);
    this.executeCurrentStep();
  }

  public skipStep() {
    this.cleanupCurrentStep();
    this.context = playerReducer(this.context, { type: "SKIP_STEP" });
    this.callbacks.onStateChange(this.context);

    if (this.context.state === "completed") {
      this.callbacks.onClearHighlight();
    } else {
      this.executeCurrentStep();
    }
  }

  public stop() {
    this.cleanupCurrentStep();
    this.context = playerReducer(this.context, { type: "STOP" });
    this.callbacks.onClearHighlight();
    this.callbacks.onStateChange(this.context);
  }

  private cleanupCurrentStep() {
    if (this.activeCleanup) {
      this.activeCleanup();
      this.activeCleanup = null;
    }
    if (this.resolveTimer) {
      clearTimeout(this.resolveTimer);
      this.resolveTimer = null;
    }
  }

  private executeCurrentStep() {
    const currentStep = this.context.journey?.steps[this.context.currentStepIndex];
    if (!currentStep) return;

    // Manual step: does not require a DOM target, completes on user click
    if (currentStep.action === "manual" || !currentStep.target) {
      this.context = playerReducer(this.context, { type: "TARGET_RESOLVED", selector: "body" });
      this.callbacks.onStateChange(this.context);
      return;
    }

    // Interactive target resolution
    const fingerprint = currentStep.target;
    const resolved = resolveTargetElement(fingerprint, document);

    if (resolved.element) {
      if (resolved.ambiguityCount > 1) {
        this.context = playerReducer(this.context, { type: "TARGET_AMBIGUOUS", count: resolved.ambiguityCount });
        this.callbacks.onStateChange(this.context);
        return;
      }

      this.context = playerReducer(this.context, {
        type: "TARGET_RESOLVED",
        selector: resolved.matchedCandidate || fingerprint.selectorCandidates[0]
      });
      this.callbacks.onHighlightTarget(resolved.element, currentStep);
      this.callbacks.onStateChange(this.context);

      // Attach observer
      this.attachObserver(resolved.element, currentStep);
    } else {
      // Retry resolution briefly before blocking (for dynamic elements)
      this.resolveTimer = setTimeout(() => {
        const retry = resolveTargetElement(fingerprint, document);
        if (retry.element) {
          this.executeCurrentStep();
        } else {
          this.context = playerReducer(this.context, {
            type: "TARGET_NOT_FOUND",
            error: `Unable to locate target: ${fingerprint.selectorCandidates[0]}`
          });
          this.callbacks.onClearHighlight();
          this.callbacks.onStateChange(this.context);
        }
      }, 1500);
    }
  }

  private attachObserver(element: Element, step: StepDefinition) {
    switch (step.action) {
      case "click":
        this.activeCleanup = observeTargetClick(element, () => this.nextStep());
        break;
      case "field-complete":
        this.activeCleanup = observeFieldCompletion(element, () => this.nextStep());
        break;
      case "navigation":
        if (step.urlMatcher) {
          this.activeCleanup = observeUrlNavigation(step.urlMatcher, () => this.nextStep());
        } else {
          this.activeCleanup = observeTargetClick(element, () => this.nextStep());
        }
        break;
      default:
        break;
    }
  }
}

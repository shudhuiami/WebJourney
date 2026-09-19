import type { Journey, StepDefinition } from "@webjourney/journey-schema";
import { playerReducer, initialPlayerContext } from "./state-machine";
import { resolveTargetElement } from "./fingerprint";
import {
  observeTargetClick,
  observeFieldCompletion,
  observeUrlNavigation,
  checkUrlMatch,
  type ObserverCleanup
} from "./observers";
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
  private mutationObserver: MutationObserver | null = null;

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
    this.context = playerReducer(initialPlayerContext, {
      type: "START",
      journey,
      startStepIndex: resumeStepIndex
    });
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
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
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
    this.cleanupCurrentStep();
    const currentStep = this.context.journey?.steps[this.context.currentStepIndex];
    if (!currentStep) return;

    // 1. Cross-Page Route Check: Verify whether learner is currently on expected page/route
    if (currentStep.urlMatcher && typeof window !== "undefined") {
      const isRouteSatisfied = checkUrlMatch(currentStep.urlMatcher);
      if (!isRouteSatisfied) {
        const expected =
          currentStep.urlMatcher.path ||
          currentStep.urlMatcher.pattern ||
          currentStep.urlMatcher.origin ||
          "target route";

        this.context = playerReducer(this.context, {
          type: "URL_MISMATCH",
          expected,
          targetUrl: currentStep.urlMatcher.targetUrl
        });
        this.callbacks.onClearHighlight();
        this.callbacks.onStateChange(this.context);

        // Listen for navigation transition to target route
        this.activeCleanup = observeUrlNavigation(currentStep.urlMatcher, () => {
          this.executeCurrentStep();
        });

        // If autoNavigate is specified and targetUrl exists, navigate automatically
        if (currentStep.urlMatcher.autoNavigate && currentStep.urlMatcher.targetUrl) {
          window.location.href = currentStep.urlMatcher.targetUrl;
        }

        return;
      }
    }

    // 2. Manual step or step without specific target: completes on user click or navigates
    if (currentStep.action === "manual" || !currentStep.target) {
      this.context = playerReducer(this.context, { type: "TARGET_RESOLVED", selector: "body" });
      this.callbacks.onStateChange(this.context);

      if (currentStep.action === "navigation" && currentStep.urlMatcher) {
        this.activeCleanup = observeUrlNavigation(currentStep.urlMatcher, () => this.nextStep());
      }
      return;
    }

    // 3. Interactive target resolution with instant lookup & MutationObserver fallback
    const fingerprint = currentStep.target;
    const initialResolved = resolveTargetElement(fingerprint, document);

    if (initialResolved.element) {
      this.activateStepWithTarget(initialResolved.element, currentStep, initialResolved.matchedCandidate || fingerprint.selectorCandidates[0]);
      return;
    }

    // Target not found yet; could be rendering asynchronously (SPA or dynamic hydration).
    // Set up MutationObserver to react immediately once target appears in DOM.
    if (typeof MutationObserver !== "undefined" && document.body) {
      this.mutationObserver = new MutationObserver(() => {
        const retryResolved = resolveTargetElement(fingerprint, document);
        if (retryResolved.element) {
          this.cleanupCurrentStep();
          this.activateStepWithTarget(retryResolved.element, currentStep, retryResolved.matchedCandidate || fingerprint.selectorCandidates[0]);
        }
      });

      this.mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true
      });
    }

    // Set fallback timeout in case the element never renders
    const maxWaitMs = Math.min(currentStep.timeoutMs || 8000, 8000);
    this.resolveTimer = setTimeout(() => {
      this.cleanupCurrentStep();
      const finalCheck = resolveTargetElement(fingerprint, document);
      if (finalCheck.element) {
        this.activateStepWithTarget(finalCheck.element, currentStep, finalCheck.matchedCandidate || fingerprint.selectorCandidates[0]);
      } else {
        this.context = playerReducer(this.context, {
          type: "TARGET_NOT_FOUND",
          error: `Unable to locate target: ${fingerprint.selectorCandidates[0]}`
        });
        this.callbacks.onClearHighlight();
        this.callbacks.onStateChange(this.context);
      }
    }, maxWaitMs);
  }

  private activateStepWithTarget(element: Element, step: StepDefinition, selector: string) {
    this.context = playerReducer(this.context, {
      type: "TARGET_RESOLVED",
      selector
    });
    this.callbacks.onHighlightTarget(element, step);
    this.callbacks.onStateChange(this.context);
    this.attachObserver(element, step);
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

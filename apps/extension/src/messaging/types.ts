import type { Journey, StepDefinition, TargetFingerprint } from "@webjourney/journey-schema";
import type { PlayerState } from "@webjourney/step-engine";

export type ExtensionMessage =
  | { type: "PING" }
  | { type: "PONG"; timestamp: number }
  // Inspector
  | { type: "START_INSPECTOR" }
  | { type: "STOP_INSPECTOR" }
  | {
      type: "ELEMENT_PICKED";
      selector: string;
      tagName: string;
      textContent?: string;
      candidatesCount: number;
      fingerprint?: TargetFingerprint;
    }
  // Highlighting & Overlays
  | {
      type: "HIGHLIGHT_TARGET";
      selector: string;
      step?: StepDefinition;
    }
  | { type: "CLEAR_HIGHLIGHT" }
  // Player state machine coordination
  | { type: "PLAYER_START"; journey: Journey }
  | { type: "PLAYER_PAUSE" }
  | { type: "PLAYER_RESUME" }
  | { type: "PLAYER_STOP" }
  | { type: "PLAYER_NEXT_STEP" }
  | { type: "PLAYER_PREV_STEP" }
  | { type: "PLAYER_STATE_UPDATED"; state: PlayerState; currentStepIndex: number; error?: string }
  // Teardown
  | { type: "TEARDOWN" };

export interface MessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

import type { Journey } from "@webjourney/journey-schema";

export type PlayerState =
  | "idle"
  | "resolving"
  | "active"
  | "verifying"
  | "blocked"
  | "paused"
  | "completed";

export type BlockReason =
  | "target_not_found"
  | "target_ambiguous"
  | "url_mismatch"
  | "timeout"
  | "permission_denied";

export interface PlayerContext {
  journey: Journey | null;
  currentStepIndex: number;
  state: PlayerState;
  blockReason?: BlockReason;
  errorMessage?: string;
  matchedElementSelector?: string;
  stepStartTime?: number;
}

export type PlayerEvent =
  | { type: "START"; journey: Journey }
  | { type: "TARGET_RESOLVED"; selector: string }
  | { type: "TARGET_NOT_FOUND"; error?: string }
  | { type: "TARGET_AMBIGUOUS"; count: number }
  | { type: "ACTION_PERFORMED" }
  | { type: "ACTION_VERIFIED" }
  | { type: "NEXT_STEP" }
  | { type: "PREVIOUS_STEP" }
  | { type: "SKIP_STEP" }
  | { type: "RETRY_STEP" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "STOP" };

export interface TargetResolutionResult {
  found: boolean;
  element?: Element;
  selector?: string;
  ambiguous?: boolean;
  candidatesCount?: number;
}

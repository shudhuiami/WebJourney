import type { Journey, JourneyVersion } from "./schema";

export interface StoredInvite {
  code: string;
  versionId: string;
  journeySnapshot: Journey;
  versionNumber: number;
  createdAt: string;
  expiresAt: string;
  revoked: boolean;
  redemptionCount: number;
  maxRedemptions?: number;
}

export interface CompletionRecord {
  journeyId: string;
  versionNumber: number;
  completedAt: string;
  totalSteps: number;
  durationMs: number;
}

/**
 * Creates an immutable version snapshot from a draft Journey.
 */
export function createPublishedVersion(draft: Journey, nextVersionNumber = 1): JourneyVersion {
  const now = new Date().toISOString();
  // Deep clone to ensure immutability
  const snapshot: Journey = JSON.parse(JSON.stringify(draft));

  return {
    id: crypto.randomUUID(),
    journeyId: draft.id,
    versionNumber: nextVersionNumber,
    snapshot,
    publishedAt: now
  };
}

/**
 * Generates an unguessable 8-character uppercase alphanumeric invite code.
 */
export function generateInviteCode(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous 0/O, 1/I
  let code = "WJ-";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Creates a stored invitation record with an expiration date.
 */
export function createInvitationRecord(
  version: JourneyVersion,
  expiresInDays = 30,
  maxRedemptions?: number
): StoredInvite {
  const now = new Date();
  const expires = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

  return {
    code: generateInviteCode(),
    versionId: version.id,
    journeySnapshot: version.snapshot,
    versionNumber: version.versionNumber,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    revoked: false,
    redemptionCount: 0,
    maxRedemptions
  };
}

/**
 * Validates whether an invitation is active and redeemable.
 */
export function validateInvitation(invite: StoredInvite): { valid: boolean; error?: string } {
  if (invite.revoked) {
    return { valid: false, error: "This invitation code has been revoked by the author." };
  }

  const now = new Date();
  if (new Date(invite.expiresAt) < now) {
    return { valid: false, error: "This invitation code has expired." };
  }

  if (invite.maxRedemptions && invite.redemptionCount >= invite.maxRedemptions) {
    return { valid: false, error: "This invitation code has reached its maximum redemptions." };
  }

  return { valid: true };
}

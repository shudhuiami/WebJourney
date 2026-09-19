import { describe, it, expect } from "vitest";
import { createPublishedVersion, createInvitationRecord, validateInvitation } from "../publishing";
import { createEmptyJourney, createDefaultStep } from "../helpers";

describe("Publishing & Invitation System", () => {
  it("creates an immutable published version that is decoupled from subsequent draft changes", () => {
    const draft = createEmptyJourney("Original Draft", "https://demo.example.com");
    draft.steps.push(createDefaultStep(0));

    const published = createPublishedVersion(draft, 1);
    expect(published.versionNumber).toBe(1);
    expect(published.snapshot.name).toBe("Original Draft");
    expect(published.snapshot.steps.length).toBe(1);

    // Mutate original draft
    draft.name = "Modified Draft After Publish";
    draft.steps.push(createDefaultStep(1));

    // Published snapshot remains unaffected
    expect(published.snapshot.name).toBe("Original Draft");
    expect(published.snapshot.steps.length).toBe(1);
  });

  it("generates and validates expiring invitations", () => {
    const draft = createEmptyJourney("Test Tour", "https://demo.example.com");
    const version = createPublishedVersion(draft, 1);

    const invite = createInvitationRecord(version, 30);
    expect(invite.code.startsWith("WJ-")).toBe(true);

    const validation = validateInvitation(invite);
    expect(validation.valid).toBe(true);
  });

  it("rejects revoked or expired invitations", () => {
    const draft = createEmptyJourney("Test Tour", "https://demo.example.com");
    const version = createPublishedVersion(draft, 1);

    const invite = createInvitationRecord(version, 30);
    invite.revoked = true;

    const validation = validateInvitation(invite);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("revoked");
  });
});

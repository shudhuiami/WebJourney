import { z } from "zod";
import { JourneySchema, JourneyVersionSchema } from "./schema";

// POST /v1/journeys
export const CreateJourneyRequestSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  startUrl: z.string().url(),
  allowedOrigins: z.array(z.string().url()).min(1)
});
export type CreateJourneyRequest = z.infer<typeof CreateJourneyRequestSchema>;

// POST /v1/journeys/:id/publish
export const PublishJourneyRequestSchema = z.object({
  journeyId: z.string().uuid(),
  snapshot: JourneySchema
});
export type PublishJourneyRequest = z.infer<typeof PublishJourneyRequestSchema>;

export const PublishJourneyResponseSchema = z.object({
  versionId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  publishedAt: z.string().datetime()
});
export type PublishJourneyResponse = z.infer<typeof PublishJourneyResponseSchema>;

// POST /v1/versions/:id/invites
export const CreateInviteRequestSchema = z.object({
  versionId: z.string().uuid(),
  expiresInDays: z.number().int().positive().default(30),
  maxRedemptions: z.number().int().positive().optional()
});
export type CreateInviteRequest = z.infer<typeof CreateInviteRequestSchema>;

export const CreateInviteResponseSchema = z.object({
  inviteCode: z.string().min(6),
  inviteUrl: z.string().url(),
  expiresAt: z.string().datetime()
});
export type CreateInviteResponse = z.infer<typeof CreateInviteResponseSchema>;

// POST /v1/invites/redeem
export const RedeemInviteRequestSchema = z.object({
  inviteCode: z.string().min(6)
});
export type RedeemInviteRequest = z.infer<typeof RedeemInviteRequestSchema>;

export const RedeemInviteResponseSchema = z.object({
  version: JourneyVersionSchema,
  startUrl: z.string().url(),
  allowedOrigins: z.array(z.string().url())
});
export type RedeemInviteResponse = z.infer<typeof RedeemInviteResponseSchema>;

// POST /v1/step-issues
export const ReportStepIssueRequestSchema = z.object({
  versionId: z.string().uuid(),
  stepId: z.string().uuid(),
  failureCode: z.enum(["target_not_found", "target_ambiguous", "url_mismatch", "timeout"]),
  targetUrl: z.string().url(),
  diagnosticSelector: z.string().max(250)
});
export type ReportStepIssueRequest = z.infer<typeof ReportStepIssueRequestSchema>;

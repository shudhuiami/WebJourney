import { z } from "zod";

export const StepActionTypeSchema = z.enum([
  "click",
  "field-complete",
  "navigation",
  "manual"
]);
export type StepActionType = z.infer<typeof StepActionTypeSchema>;

export const TargetFingerprintSchema = z.object({
  selectorCandidates: z.array(z.string().min(1)).min(1),
  tagName: z.string().min(1),
  role: z.string().optional(),
  accessibleLabel: z.string().optional(),
  textContentSnippet: z.string().max(80).optional(),
  testId: z.string().optional(),
  attributes: z.record(z.string()).optional()
});
export type TargetFingerprint = z.infer<typeof TargetFingerprintSchema>;

export const UrlMatcherSchema = z.object({
  origin: z.string().url(),
  path: z.string().optional(),
  pattern: z.string().optional()
});
export type UrlMatcher = z.infer<typeof UrlMatcherSchema>;

export const StepButtonActionSchema = z.enum([
  "next",
  "back",
  "skip",
  "exit",
  "url"
]);
export type StepButtonAction = z.infer<typeof StepButtonActionSchema>;

export const StepButtonVariantSchema = z.enum([
  "primary",
  "secondary",
  "danger",
  "success"
]);
export type StepButtonVariant = z.infer<typeof StepButtonVariantSchema>;

export const StepButtonSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(50),
  action: StepButtonActionSchema,
  url: z.string().optional(),
  variant: StepButtonVariantSchema.default("secondary")
});
export type StepButton = z.infer<typeof StepButtonSchema>;

export const StepDefinitionSchema = z.object({
  id: z.string().uuid(),
  order: z.number().int().nonnegative(),
  title: z.string().min(1).max(120),
  instruction: z.string().min(1).max(1000),
  action: StepActionTypeSchema,
  target: TargetFingerprintSchema.optional(),
  urlMatcher: UrlMatcherSchema.optional(),
  timeoutMs: z.number().int().positive().default(30000),
  allowSkip: z.boolean().default(false),
  fallbackInstruction: z.string().max(500).optional(),
  showExitButton: z.boolean().optional(),
  exitButtonLabel: z.string().max(40).optional(),
  customButtons: z.array(StepButtonSchema).optional()
});
export type StepDefinition = z.infer<typeof StepDefinitionSchema>;

export const JourneySchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  allowedOrigins: z.array(z.string().url()).min(1),
  startUrl: z.string().url(),
  steps: z.array(StepDefinitionSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type Journey = z.infer<typeof JourneySchema>;

export const JourneyVersionSchema = z.object({
  id: z.string().uuid(),
  journeyId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  snapshot: JourneySchema,
  publishedAt: z.string().datetime(),
  publisherId: z.string().optional()
});
export type JourneyVersion = z.infer<typeof JourneyVersionSchema>;

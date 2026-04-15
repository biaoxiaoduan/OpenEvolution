import { z } from "zod";

export const bucketInterpretationSchema = z.object({
  bucketId: z.string(),
  summary: z.string(),
  dominantWorkTypes: z.array(z.string()),
  productIntent: z.string(),
});

export const evolutionStageSchema = z.object({
  id: z.string(),
  name: z.enum(["exploration", "formation", "growth", "breakout"]),
  startAt: z.string(),
  endAt: z.string(),
  summary: z.string(),
  whyThisStage: z.string(),
  dominantWorkTypes: z.array(z.string()),
  productState: z.string(),
  evidenceBucketIds: z.array(z.string()),
});

export const milestoneSchema = z.object({
  type: z.enum([
    "first_usable",
    "first_good_ux",
    "first_demo_ready",
    "pre_breakout_turning_point",
    "direction_shift",
  ]),
  timestamp: z.string(),
  title: z.string(),
  summary: z.string(),
  whyItMatters: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  evidenceBucketIds: z.array(z.string()),
});

export const insightSchema = z.object({
  pattern: z.string(),
  evidence: z.string(),
  transferableTakeaway: z.string(),
});

export const bucketInterpretationArraySchema = z.array(bucketInterpretationSchema);
export const evolutionStageArraySchema = z.array(evolutionStageSchema);
export const milestoneArraySchema = z.array(milestoneSchema);

export const synthesisSchema = z.object({
  breakoutAnalysis: z.string(),
  insights: z.array(insightSchema),
});

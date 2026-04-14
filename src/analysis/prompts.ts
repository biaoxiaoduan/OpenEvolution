import type {
  BucketInterpretation,
  EvolutionStage,
  Milestone,
  TimeBucket,
} from "../types/domain.js";

export function buildBucketPrompt(bucket: TimeBucket): string {
  return [
    "Interpret this repository time bucket as product evolution evidence.",
    "Return JSON with fields: bucketId, summary, dominantWorkTypes, productIntent.",
    JSON.stringify(bucket, null, 2),
  ].join("\n");
}

export function buildStageSegmentationPrompt(
  buckets: Array<TimeBucket & { interpretation: BucketInterpretation }>,
): string {
  return [
    "Segment repository evolution into stages.",
    "Return JSON array of stage objects with: id, name, startAt, endAt, summary, whyThisStage, dominantWorkTypes, productState, evidenceBucketIds.",
    JSON.stringify(buckets, null, 2),
  ].join("\n");
}

export function buildMilestonePrompt(input: {
  buckets: Array<TimeBucket & { interpretation: BucketInterpretation }>;
  stages: EvolutionStage[];
}): string {
  return [
    "Detect major repository milestones.",
    "Return JSON array of milestone objects with: type, timestamp, title, summary, whyItMatters, confidence, evidenceBucketIds.",
    JSON.stringify(input, null, 2),
  ].join("\n");
}

export function buildSynthesisPrompt(input: {
  project: {
    repository: { owner: string; name: string; slug: string; url: string };
    stats: { stars: number; forks: number; contributors: number };
    firstCommitAt: string;
    analyzedAt: string;
  };
  buckets: Array<TimeBucket & { interpretation: BucketInterpretation }>;
  stages: EvolutionStage[];
  milestones: Milestone[];
}): string {
  return [
    "Synthesize breakout analysis and transferable insights from repository evolution.",
    "Return JSON object with fields: breakoutAnalysis, insights.",
    JSON.stringify(input, null, 2),
  ].join("\n");
}

import type {
  AnalysisResult,
  BucketInterpretation,
  TimeBucket,
} from "../types/domain.js";
import type { JsonSchemaClient } from "./llm-client.js";
import { detectMilestones } from "./detect-milestones.js";
import { buildSynthesisPrompt } from "./prompts.js";
import { segmentStages } from "./segment-stages.js";

export async function synthesizeAnalysis(input: {
  project: AnalysisResult["project"];
  timelineBuckets: Array<TimeBucket & { interpretation: BucketInterpretation }>;
  client: JsonSchemaClient;
  model?: string;
}): Promise<AnalysisResult> {
  const stages = await segmentStages({
    buckets: input.timelineBuckets,
    client: input.client,
    model: input.model,
  });

  const milestones = await detectMilestones({
    buckets: input.timelineBuckets,
    stages,
    client: input.client,
    model: input.model,
  });

  const synthesis = await input.client.generateJson<{
    breakoutAnalysis: string;
    insights: AnalysisResult["insights"];
  }>({
    model: input.model ?? "gpt-5.4-mini",
    system:
      "Synthesize breakout analysis and transferable insights from repository evolution. Return JSON only.",
    user: buildSynthesisPrompt({
      project: input.project,
      buckets: input.timelineBuckets,
      stages,
      milestones,
    }),
  });

  return {
    project: input.project,
    timelineBuckets: input.timelineBuckets,
    stages,
    milestones,
    breakoutAnalysis: synthesis.breakoutAnalysis,
    insights: synthesis.insights,
  };
}

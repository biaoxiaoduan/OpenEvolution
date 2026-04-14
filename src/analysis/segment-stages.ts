import type {
  BucketInterpretation,
  EvolutionStage,
  TimeBucket,
} from "../types/domain.js";
import type { JsonSchemaClient } from "./llm-client.js";
import { buildStageSegmentationPrompt } from "./prompts.js";

export async function segmentStages(input: {
  buckets: Array<TimeBucket & { interpretation: BucketInterpretation }>;
  client: JsonSchemaClient;
  model?: string;
}): Promise<EvolutionStage[]> {
  return input.client.generateJson<EvolutionStage[]>({
    model: input.model ?? "gpt-5.4-mini",
    system: "Segment repository evolution into stages and return JSON only.",
    user: buildStageSegmentationPrompt(input.buckets),
  });
}

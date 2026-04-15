import type {
  BucketInterpretation,
  EvolutionStage,
  Milestone,
  TimeBucket,
} from "../types/domain.js";
import type { JsonSchemaClient } from "./llm-client.js";
import { buildMilestonePrompt } from "./prompts.js";
import { milestoneArraySchema } from "./schemas.js";

export async function detectMilestones(input: {
  buckets: Array<TimeBucket & { interpretation: BucketInterpretation }>;
  stages: EvolutionStage[];
  client: JsonSchemaClient;
  model?: string;
}): Promise<Milestone[]> {
  return input.client.generateJson<Milestone[]>({
    model: input.model ?? "gpt-5.4-mini",
    system: "Detect major repository milestones and return JSON only.",
    user: buildMilestonePrompt({
      buckets: input.buckets,
      stages: input.stages,
    }),
    schema: milestoneArraySchema,
    schemaName: "milestones",
  });
}

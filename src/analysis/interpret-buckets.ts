import type { BucketInterpretation, TimeBucket } from "../types/domain.js";
import type { JsonSchemaClient } from "./llm-client.js";
import { buildBucketPrompt } from "./prompts.js";
import { bucketInterpretationSchema } from "./schemas.js";

export async function interpretBuckets(input: {
  buckets: TimeBucket[];
  client: JsonSchemaClient;
  model?: string;
}): Promise<BucketInterpretation[]> {
  const interpretations: BucketInterpretation[] = [];

  for (const bucket of input.buckets) {
    const interpretation = await input.client.generateJson<BucketInterpretation>({
      model: input.model ?? "gpt-5.4-mini",
      system:
        "You infer product intent from open-source repository history and return valid JSON only.",
      user: buildBucketPrompt(bucket),
      schema: bucketInterpretationSchema,
      schemaName: "bucket_interpretation",
    });
    interpretations.push(interpretation);
  }

  return interpretations;
}

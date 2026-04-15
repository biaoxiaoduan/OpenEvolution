import type {
  AnalysisResult,
  BucketInterpretation,
  TimeBucket,
} from "../types/domain.js";
import type { JsonSchemaClient } from "./llm-client.js";
import { detectMilestones } from "./detect-milestones.js";
import { buildSynthesisPrompt } from "./prompts.js";
import { synthesisSchema } from "./schemas.js";
import { segmentStages } from "./segment-stages.js";

function toTitleCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function stringifyNarrativeValue(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => stringifyNarrativeValue(item))
      .filter(Boolean)
      .join("\n");
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nestedValue]) => {
        const renderedValue = stringifyNarrativeValue(nestedValue);
        return renderedValue ? `${toTitleCase(key)}: ${renderedValue}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function normalizeInsights(
  value: unknown,
): Array<{
  pattern: string;
  evidence: string;
  transferableTakeaway: string;
}> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((insight, index) => {
      if (typeof insight === "string") {
        const takeaway = insight.trim();

        if (!takeaway) {
          return null;
        }

        return {
          pattern: `Insight ${index + 1}`,
          evidence: "Model returned a narrative insight without separate evidence.",
          transferableTakeaway: takeaway,
        };
      }

      if (!insight || typeof insight !== "object") {
        return null;
      }

      const record = insight as Record<string, unknown>;
      const pattern = stringifyNarrativeValue(record.pattern);
      const evidence = stringifyNarrativeValue(record.evidence);
      const transferableTakeaway = stringifyNarrativeValue(
        record.transferableTakeaway ?? record.takeaway,
      );

      if (!pattern && !evidence && !transferableTakeaway) {
        return null;
      }

      return {
        pattern: pattern || `Insight ${index + 1}`,
        evidence:
          evidence || "Model did not provide separate supporting evidence for this insight.",
        transferableTakeaway:
          transferableTakeaway || pattern || "Model returned an empty insight entry.",
      };
    })
    .filter(
      (
        insight,
      ): insight is {
        pattern: string;
        evidence: string;
        transferableTakeaway: string;
      } => Boolean(insight),
    );
}

function normalizeSynthesisPayload(value: {
  breakoutAnalysis?: unknown;
  insights?: unknown;
}): {
  breakoutAnalysis: string;
  insights: Array<{
    pattern: string;
    evidence: string;
    transferableTakeaway: string;
  }>;
} {
  const breakoutAnalysis =
    stringifyNarrativeValue(value.breakoutAnalysis) || "No breakout analysis generated.";

  return {
    breakoutAnalysis,
    insights: normalizeInsights(value.insights),
  };
}

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

  const synthesis = normalizeSynthesisPayload(await input.client.generateJson<{
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
    schema: synthesisSchema,
    schemaName: "analysis_synthesis",
  }));

  return {
    project: input.project,
    timelineBuckets: input.timelineBuckets,
    stages,
    milestones,
    breakoutAnalysis: synthesis.breakoutAnalysis,
    insights: synthesis.insights,
  };
}

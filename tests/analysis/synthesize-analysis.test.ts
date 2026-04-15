import { describe, expect, it } from "vitest";
import { synthesizeAnalysis } from "../../src/analysis/synthesize-analysis.js";

describe("synthesizeAnalysis", () => {
  it("assembles stages, milestones, breakout analysis, and insights into the final artifact", async () => {
    const result = await synthesizeAnalysis({
      project: {
        repository: { owner: "acme", name: "rocket", url: "https://github.com/acme/rocket", slug: "acme-rocket" },
        stats: { stars: 120, forks: 12, contributors: 3 },
        firstCommitAt: "2024-01-01T00:00:00Z",
        analyzedAt: "2026-04-15T00:00:00Z",
      },
      timelineBuckets: [
        {
          id: "bucket-1",
          startAt: "2024-01-01T00:00:00Z",
          endAt: "2024-01-07T00:00:00Z",
          commitTitles: ["Initial prototype"],
          pullRequestTitles: [],
          releases: [],
          readmeChanged: false,
          starDelta: 2,
          interpretation: {
            bucketId: "bucket-1",
            summary: "Technical validation",
            dominantWorkTypes: ["technical"],
            productIntent: "Test viability",
          },
        },
      ],
      client: {
        listModels: async () => ["qwen3.5-flash"],
        generateJson: async <T>({ system }: { system: string }) => {
          if (system.includes("Segment repository evolution")) {
            return [
              {
                id: "stage-1",
                name: "exploration",
                startAt: "2024-01-01T00:00:00Z",
                endAt: "2024-01-07T00:00:00Z",
                summary: "Early exploration",
                whyThisStage: "Only technical validation work exists.",
                dominantWorkTypes: ["technical"],
                productState: "Prototype",
                evidenceBucketIds: ["bucket-1"],
              },
            ] as T;
          }

          if (system.includes("Detect major repository milestones")) {
            return [] as T;
          }

          return {
            breakoutAnalysis: "No confident breakout detected.",
            insights: [
              {
                pattern: "Start narrow",
                evidence: "Only one technical bucket exists.",
                transferableTakeaway: "Begin with one clear use case.",
              },
            ],
          } as T;
        },
      },
    });

    expect(result.stages[0].name).toBe("exploration");
    expect(result.breakoutAnalysis).toContain("No confident breakout");
    expect(result.insights[0].pattern).toBe("Start narrow");
  });

  it("normalizes synthesis payloads from OpenAI-compatible models that return looser shapes", async () => {
    const result = await synthesizeAnalysis({
      project: {
        repository: { owner: "acme", name: "rocket", url: "https://github.com/acme/rocket", slug: "acme-rocket" },
        stats: { stars: 120, forks: 12, contributors: 3 },
        firstCommitAt: "2024-01-01T00:00:00Z",
        analyzedAt: "2026-04-15T00:00:00Z",
      },
      timelineBuckets: [
        {
          id: "bucket-1",
          startAt: "2024-01-01T00:00:00Z",
          endAt: "2024-01-07T00:00:00Z",
          commitTitles: ["Initial prototype"],
          pullRequestTitles: [],
          releases: [],
          readmeChanged: false,
          starDelta: 2,
          interpretation: {
            bucketId: "bucket-1",
            summary: "Technical validation",
            dominantWorkTypes: ["technical"],
            productIntent: "Test viability",
          },
        },
      ],
      client: {
        listModels: async () => ["qwen3.5-flash"],
        generateJson: async <T>({ system }: { system: string }) => {
          if (system.includes("Segment repository evolution")) {
            return [] as T;
          }

          if (system.includes("Detect major repository milestones")) {
            return [] as T;
          }

          return {
            breakoutAnalysis: {
              temporalDensity: "All activity landed in one sprint.",
              infrastructureMaturitySignal: "Tooling and typing were established early.",
            },
            insights: [
              "Front-load development tooling to keep rapid delivery stable.",
              {
                pattern: "Schema-first iteration",
                evidence: "The schema changed alongside ingestion fixes.",
                transferableTakeaway: "Treat domain contracts as living interfaces.",
              },
            ],
          } as T;
        },
      },
    });

    expect(result.breakoutAnalysis).toContain("Temporal Density");
    expect(result.breakoutAnalysis).toContain("All activity landed in one sprint.");
    expect(result.insights[0]).toEqual({
      pattern: "Insight 1",
      evidence: "Model returned a narrative insight without separate evidence.",
      transferableTakeaway:
        "Front-load development tooling to keep rapid delivery stable.",
    });
    expect(result.insights[1].pattern).toBe("Schema-first iteration");
  });
});

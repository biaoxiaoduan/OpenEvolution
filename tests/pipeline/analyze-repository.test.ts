import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { analyzeRepository } from "../../src/pipeline/analyze-repository.js";

describe("analyzeRepository", () => {
  it("writes analysis.json and index.html for a successful run", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const result = await analyzeRepository({
      command: {
        repoUrl: "https://github.com/acme/rocket",
        outputDir: "./tmp/acme-rocket-pipeline-test",
        model: "gpt-5.4-mini",
        noCache: true,
        debug: true,
      },
      dependencies: {
        collectRepositoryData: async () => ({
          repository: { owner: "acme", name: "rocket", url: "https://github.com/acme/rocket", slug: "acme-rocket" },
          stats: { stars: 42, forks: 5, contributors: 2 },
          firstCommitAt: "2024-01-01T00:00:00Z",
          commits: [{ sha: "1", authoredAt: "2024-01-01T00:00:00Z", title: "Initial prototype", body: "" }],
          pullRequests: [],
          releases: [],
          readmeSnapshots: [],
          starHistory: [],
        }),
        interpretBuckets: async (input) =>
          input.buckets.map((bucket) => ({
            bucketId: bucket.id,
            summary: "Initial technical validation",
            dominantWorkTypes: ["technical"],
            productIntent: "Validate feasibility",
          })),
        synthesizeAnalysis: async (input) => ({
          project: input.project,
          timelineBuckets: input.timelineBuckets,
          stages: [],
          milestones: [],
          breakoutAnalysis: "No confident breakout detected.",
          insights: [],
        }),
        createClient: () => ({
          generateJson: async () => {
            throw new Error("The pipeline test should use the injected analysis stages");
          },
        }),
      },
    });

    expect(result.paths.analysisJson.endsWith("artifacts/analysis.json")).toBe(true);
    expect(result.paths.reportHtml.endsWith("report/index.html")).toBe(true);

    const analysisJson = await readFile(result.paths.analysisJson, "utf8");
    const reportHtml = await readFile(result.paths.reportHtml, "utf8");

    expect(analysisJson).toContain("No confident breakout detected.");
    expect(reportHtml).toContain("Breakout Analysis");
  });

  it("filters collected evidence by the requested time window", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const collectedInputs: Array<{
      commitTitles: string[];
      pullRequestTitles: string[];
      releases: string[];
    }> = [];

    await analyzeRepository({
      command: {
        repoUrl: "https://github.com/acme/rocket",
        outputDir: "./tmp/acme-rocket-filter-test",
        model: "gpt-5.4-mini",
        since: "2024-02-01",
        until: "2024-02-29",
        noCache: true,
        debug: false,
      },
      dependencies: {
        collectRepositoryData: async () => ({
          repository: { owner: "acme", name: "rocket", url: "https://github.com/acme/rocket", slug: "acme-rocket" },
          stats: { stars: 42, forks: 5, contributors: 2 },
          firstCommitAt: "2024-01-01T00:00:00Z",
          commits: [
            { sha: "old", authoredAt: "2024-01-01T00:00:00Z", title: "Initial prototype", body: "" },
            { sha: "new", authoredAt: "2024-02-10T00:00:00Z", title: "Launch onboarding", body: "" },
          ],
          pullRequests: [
            { number: 1, title: "Old PR", mergedAt: "2024-01-10T00:00:00Z" },
            { number: 2, title: "New PR", mergedAt: "2024-02-12T00:00:00Z" },
          ],
          releases: [
            { tagName: "v0.1.0", name: "v0.1.0", publishedAt: "2024-01-12T00:00:00Z" },
            { tagName: "v0.2.0", name: "v0.2.0", publishedAt: "2024-02-18T00:00:00Z" },
          ],
          readmeSnapshots: [
            { capturedAt: "2024-01-15T00:00:00Z", content: "old" },
            { capturedAt: "2024-02-19T00:00:00Z", content: "new" },
          ],
          starHistory: [
            { timestamp: "2024-01-07T00:00:00Z", stars: 3 },
            { timestamp: "2024-02-25T00:00:00Z", stars: 12 },
          ],
        }),
        interpretBuckets: async (input) => {
          collectedInputs.push({
            commitTitles: input.buckets.flatMap((bucket) => bucket.commitTitles),
            pullRequestTitles: input.buckets.flatMap(
              (bucket) => bucket.pullRequestTitles,
            ),
            releases: input.buckets.flatMap((bucket) => bucket.releases),
          });

          return input.buckets.map((bucket) => ({
            bucketId: bucket.id,
            summary: "Filtered bucket",
            dominantWorkTypes: ["product"],
            productIntent: "Focus on the selected window",
          }));
        },
        synthesizeAnalysis: async (input) => ({
          project: input.project,
          timelineBuckets: input.timelineBuckets,
          stages: [],
          milestones: [],
          breakoutAnalysis: "Filtered analysis.",
          insights: [],
        }),
        createClient: () => ({
          generateJson: async () => {
            throw new Error("The pipeline test should use the injected analysis stages");
          },
        }),
      },
    });

    expect(collectedInputs).toEqual([
      {
        commitTitles: ["Launch onboarding"],
        pullRequestTitles: ["New PR"],
        releases: ["v0.2.0"],
      },
    ]);
  });
});

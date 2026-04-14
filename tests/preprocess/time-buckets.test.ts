import { describe, expect, it } from "vitest";
import { buildTimeBuckets } from "../../src/preprocess/time-buckets.js";

describe("buildTimeBuckets", () => {
  it("groups repository events into chronological weekly buckets", () => {
    const buckets = buildTimeBuckets({
      commits: [
        { sha: "1", authoredAt: "2024-01-01T00:00:00Z", title: "Initial prototype", body: "" },
        { sha: "2", authoredAt: "2024-01-03T00:00:00Z", title: "Add landing page", body: "" },
        { sha: "3", authoredAt: "2024-01-10T00:00:00Z", title: "Ship onboarding", body: "" },
      ],
      pullRequests: [
        { number: 9, title: "Add demo flow", mergedAt: "2024-01-04T00:00:00Z" },
        { number: 10, title: "Refine onboarding", mergedAt: "2024-01-11T00:00:00Z" },
      ],
      releases: [{ tagName: "v0.1.0", name: "v0.1.0", publishedAt: "2024-01-05T00:00:00Z" }],
      readmeSnapshots: [{ capturedAt: "2024-01-09T00:00:00Z", content: "# New README" }],
      starHistory: [
        { timestamp: "2024-01-01T00:00:00Z", stars: 3 },
        { timestamp: "2024-01-07T00:00:00Z", stars: 15 },
        { timestamp: "2024-01-08T00:00:00Z", stars: 15 },
        { timestamp: "2024-01-14T00:00:00Z", stars: 21 },
      ],
    });

    expect(buckets).toHaveLength(2);
    expect(buckets[0]).toMatchObject({
      commitTitles: ["Initial prototype", "Add landing page"],
      pullRequestTitles: ["Add demo flow"],
      releases: ["v0.1.0"],
      readmeChanged: false,
      starDelta: 12,
    });
    expect(buckets[1]).toMatchObject({
      commitTitles: ["Ship onboarding"],
      pullRequestTitles: ["Refine onboarding"],
      releases: [],
      readmeChanged: true,
      starDelta: 6,
    });
  });
});

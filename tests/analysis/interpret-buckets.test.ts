import { describe, expect, it } from "vitest";
import { interpretBuckets } from "../../src/analysis/interpret-buckets.js";

describe("interpretBuckets", () => {
  it("maps raw buckets into structured bucket interpretations", async () => {
    const result = await interpretBuckets({
      buckets: [
        {
          id: "2024-01-01T00:00:00.000Z",
          startAt: "2024-01-01T00:00:00.000Z",
          endAt: "2024-01-07T00:00:00.000Z",
          commitTitles: ["Initial prototype", "Add onboarding page"],
          pullRequestTitles: ["Add demo flow"],
          releases: ["v0.1.0"],
          readmeChanged: true,
          starDelta: 15,
        },
      ],
      client: {
        generateJson: async <T>() =>
          ({
            bucketId: "2024-01-01T00:00:00.000Z",
            summary: "The project moved from prototype to demoable product.",
            dominantWorkTypes: ["product", "ux"],
            productIntent: "Lower the adoption barrier for first-time users.",
          }) as T,
      },
    });

    expect(result[0].productIntent).toContain("adoption barrier");
  });
});

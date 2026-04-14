import { describe, expect, it } from "vitest";
import { renderReportHtml } from "../../src/render/render-report.js";

describe("renderReportHtml", () => {
  it("renders the required report sections from an analysis result", () => {
    const html = renderReportHtml({
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
        },
      ],
      stages: [],
      milestones: [],
      breakoutAnalysis: "README and demo improvements preceded growth.",
      insights: [
        {
          pattern: "README is a product surface",
          evidence: "The README changed before breakout.",
          transferableTakeaway: "Invest in onboarding assets early.",
        },
      ],
    });

    expect(html).toContain("Growth Timeline");
    expect(html).toContain("Breakout Analysis");
    expect(html).toContain("README is a product surface");
    expect(html).toContain("Evidence Drawer");
  });
});

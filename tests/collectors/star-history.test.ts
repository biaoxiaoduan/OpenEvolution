import { describe, expect, it } from "vitest";
import { collectStarHistory } from "../../src/collectors/star-history.js";

describe("collectStarHistory", () => {
  it("returns an empty array when the provider is unavailable", async () => {
    const result = await collectStarHistory({
      repoUrl: "https://github.com/acme/rocket",
      endpoint: "https://stars.example.com/history",
      fetcher: async () => {
        throw new Error("service unavailable");
      },
    });

    expect(result).toEqual([]);
  });

  it("normalizes provider data when the provider succeeds", async () => {
    const result = await collectStarHistory({
      repoUrl: "https://github.com/acme/rocket",
      endpoint: "https://stars.example.com/history",
      fetcher: async () => [
        { timestamp: "2024-01-01T00:00:00Z", stars: 3 },
        { timestamp: "2024-01-08T00:00:00Z", stars: 11 },
      ],
    });

    expect(result).toEqual([
      { timestamp: "2024-01-01T00:00:00Z", stars: 3 },
      { timestamp: "2024-01-08T00:00:00Z", stars: 11 },
    ]);
  });
});

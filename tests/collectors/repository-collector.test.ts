import { describe, expect, it } from "vitest";
import { collectRepositoryData } from "../../src/collectors/repository-collector.js";

describe("collectRepositoryData", () => {
  it("normalizes repository metadata, commits, pull requests, and releases", async () => {
    const data = await collectRepositoryData({
      repoUrl: "https://github.com/acme/rocket",
      githubToken: "test-token",
      fetcher: async (url: string) => {
        if (url.includes("/repos/acme/rocket")) {
          return { stargazers_count: 42, forks_count: 7, description: "Rocket", default_branch: "main" };
        }

        if (url.includes("/commits")) {
          return [{ sha: "abc", commit: { author: { date: "2024-01-01T00:00:00Z" }, message: "Initial prototype" } }];
        }

        if (url.includes("/pulls")) {
          return [{ number: 9, title: "Add shareable demo", merged_at: "2024-01-05T00:00:00Z" }];
        }

        if (url.includes("/releases")) {
          return [{ tag_name: "v0.1.0", name: "v0.1.0", published_at: "2024-01-06T00:00:00Z" }];
        }

        if (url.includes("/contributors")) {
          return [{ login: "alice" }, { login: "bob" }];
        }

        throw new Error(`Unexpected URL: ${url}`);
      },
    });

    expect(data.repository.slug).toBe("acme-rocket");
    expect(data.stats.stars).toBe(42);
    expect(data.commits[0].title).toBe("Initial prototype");
    expect(data.pullRequests[0].title).toBe("Add shareable demo");
    expect(data.releases[0].tagName).toBe("v0.1.0");
  });
});

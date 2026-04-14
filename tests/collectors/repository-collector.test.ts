import { describe, expect, it } from "vitest";
import { collectRepositoryData } from "../../src/collectors/repository-collector.js";

describe("collectRepositoryData", () => {
  it("normalizes repository metadata, commits, pull requests, and releases", async () => {
    const requestedUrls: string[] = [];

    const data = await collectRepositoryData({
      repoUrl: "https://github.com/acme/rocket",
      githubToken: "test-token",
      fetcher: async (url: string) => {
        requestedUrls.push(url);

        if (url === "/repos/acme/rocket") {
          return { stargazers_count: 42, forks_count: 7, description: "Rocket", default_branch: "main" };
        }

        if (url === "/commits/acme/rocket?per_page=100&page=1") {
          return [{ sha: "abc", commit: { author: { date: "2024-01-01T00:00:00Z" }, message: "Initial prototype" } }];
        }

        if (url === "/commits/acme/rocket?per_page=100&page=2") {
          return [];
        }

        if (url === "/pulls/acme/rocket?state=closed&sort=updated&direction=desc&per_page=100&page=1") {
          return [{ number: 9, title: "Add shareable demo", merged_at: "2024-01-05T00:00:00Z" }];
        }

        if (url === "/pulls/acme/rocket?state=closed&sort=updated&direction=desc&per_page=100&page=2") {
          return [];
        }

        if (url === "/releases/acme/rocket?per_page=20&page=1") {
          return [{ tag_name: "v0.1.0", name: "", published_at: null }];
        }

        if (url === "/releases/acme/rocket?per_page=20&page=2") {
          return [];
        }

        if (url === "/contributors/acme/rocket?per_page=20&page=1") {
          return [{ login: "alice" }, { login: "bob" }];
        }

        if (url === "/contributors/acme/rocket?per_page=20&page=2") {
          return [];
        }

        throw new Error(`Unexpected URL: ${url}`);
      },
    });

    expect(data.repository.slug).toBe("acme-rocket");
    expect(data.stats.stars).toBe(42);
    expect(data.stats.contributors).toBe(2);
    expect(data.commits[0].title).toBe("Initial prototype");
    expect(data.pullRequests[0].title).toBe("Add shareable demo");
    expect(data.releases[0].tagName).toBe("v0.1.0");
    expect(data.releases[0].name).toBe("v0.1.0");
    expect(data.releases[0].publishedAt).toBe("");
    expect(data.readmeSnapshots).toEqual([]);
    expect(data.starHistory).toEqual([]);
    expect(requestedUrls).toContain("/commits/acme/rocket?per_page=100&page=1");
    expect(requestedUrls).toContain("/pulls/acme/rocket?state=closed&sort=updated&direction=desc&per_page=100&page=1");
    expect(requestedUrls).toContain("/releases/acme/rocket?per_page=20&page=1");
    expect(requestedUrls).toContain("/contributors/acme/rocket?per_page=20&page=1");
  });

  it("falls back to the current timestamp when commit history is empty", async () => {
    const before = Date.now();

    const data = await collectRepositoryData({
      repoUrl: "https://github.com/acme/rocket",
      fetcher: async (url: string) => {
        if (url.includes("/repos/acme/rocket")) {
          return { stargazers_count: 42, forks_count: 7 };
        }

        if (url.includes("/commits")) {
          return [];
        }

        if (url.includes("/pulls") || url.includes("/releases") || url.includes("/contributors")) {
          return [];
        }

        throw new Error(`Unexpected URL: ${url}`);
      },
    });

    const after = Date.now();
    const firstCommitAt = Date.parse(data.firstCommitAt);

    expect(Number.isNaN(firstCommitAt)).toBe(false);
    expect(firstCommitAt).toBeGreaterThanOrEqual(before);
    expect(firstCommitAt).toBeLessThanOrEqual(after);
  });

  it("collects multiple pages from paginated GitHub endpoints", async () => {
    const requestedUrls: string[] = [];

    const data = await collectRepositoryData({
      repoUrl: "https://www.github.com/acme/rocket.git",
      fetcher: async (url: string) => {
        requestedUrls.push(url);

        if (url === "/repos/acme/rocket") {
          return { stargazers_count: 42, forks_count: 7 };
        }

        if (url === "/commits/acme/rocket?per_page=100&page=1") {
          return [{ sha: "def", commit: { author: { date: "2024-01-03T00:00:00Z" }, message: "Second commit" } }];
        }

        if (url === "/commits/acme/rocket?per_page=100&page=2") {
          return [{ sha: "abc", commit: { author: { date: "2024-01-01T00:00:00Z" }, message: "Initial prototype" } }];
        }

        if (url === "/commits/acme/rocket?per_page=100&page=3") {
          return [];
        }

        if (url === "/pulls/acme/rocket?state=closed&sort=updated&direction=desc&per_page=100&page=1") {
          return [{ number: 9, title: "Add shareable demo", merged_at: "2024-01-05T00:00:00Z" }];
        }

        if (url === "/pulls/acme/rocket?state=closed&sort=updated&direction=desc&per_page=100&page=2") {
          return [{ number: 8, title: "Draft PR", merged_at: null }];
        }

        if (url === "/pulls/acme/rocket?state=closed&sort=updated&direction=desc&per_page=100&page=3") {
          return [];
        }

        if (url === "/releases/acme/rocket?per_page=20&page=1") {
          return [{ tag_name: "v0.2.0", name: "v0.2.0", published_at: "2024-01-10T00:00:00Z" }];
        }

        if (url === "/releases/acme/rocket?per_page=20&page=2") {
          return [{ tag_name: "v0.1.0", name: null, published_at: "2024-01-06T00:00:00Z" }];
        }

        if (url === "/releases/acme/rocket?per_page=20&page=3") {
          return [];
        }

        if (url === "/contributors/acme/rocket?per_page=20&page=1") {
          return [{ login: "alice" }];
        }

        if (url === "/contributors/acme/rocket?per_page=20&page=2") {
          return [{ login: "bob" }];
        }

        if (url === "/contributors/acme/rocket?per_page=20&page=3") {
          return [];
        }

        throw new Error(`Unexpected URL: ${url}`);
      },
    });

    expect(data.repository).toEqual({
      owner: "acme",
      name: "rocket",
      slug: "acme-rocket",
      url: "https://github.com/acme/rocket",
    });
    expect(data.commits.map((commit) => commit.sha)).toEqual(["def", "abc"]);
    expect(data.pullRequests).toEqual([{ number: 9, title: "Add shareable demo", mergedAt: "2024-01-05T00:00:00Z" }]);
    expect(data.releases.map((release) => release.tagName)).toEqual(["v0.2.0", "v0.1.0"]);
    expect(data.stats.contributors).toBe(2);
    expect(requestedUrls).toContain("/commits/acme/rocket?per_page=100&page=2");
    expect(requestedUrls).toContain("/pulls/acme/rocket?state=closed&sort=updated&direction=desc&per_page=100&page=2");
    expect(requestedUrls).toContain("/releases/acme/rocket?per_page=20&page=2");
    expect(requestedUrls).toContain("/contributors/acme/rocket?per_page=20&page=2");
  });
});

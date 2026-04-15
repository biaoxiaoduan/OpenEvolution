import { describe, expect, it } from "vitest";
import { collectReadmeSnapshots } from "../../src/collectors/readme-snapshots.js";

describe("collectReadmeSnapshots", () => {
  it("returns README snapshots from matching commits", async () => {
    const snapshots = await collectReadmeSnapshots(
      {
        owner: "acme",
        name: "rocket",
        slug: "acme-rocket",
        url: "https://github.com/acme/rocket",
      },
      {
        fetchCommitList: async () => [
          { sha: "a", authoredAt: "2024-01-01T00:00:00Z" },
          { sha: "b", authoredAt: "2024-01-10T00:00:00Z" },
        ],
        fetchReadmeAtCommit: async (sha) => `README at ${sha}`,
      },
    );

    expect(snapshots).toEqual([
      { capturedAt: "2024-01-01T00:00:00Z", content: "README at a" },
      { capturedAt: "2024-01-10T00:00:00Z", content: "README at b" },
    ]);
  });
});

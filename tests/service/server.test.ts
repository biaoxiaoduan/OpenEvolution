import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { createServer } from "../../src/service/server.js";

async function listen(server: ReturnType<typeof createServer>): Promise<string> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Server did not bind to an IPv4 address");
  }

  return `http://127.0.0.1:${address.port}`;
}

describe("service server", () => {
  it("accepts a job and returns a job id", async () => {
    const server = createServer({
      submitJob: async () => ({ id: "job-1", status: "queued" }),
      getJob: async () => null,
    });
    const baseUrl = await listen(server);

    try {
      const response = await fetch(`${baseUrl}/jobs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repoUrl: "https://github.com/acme/rocket",
          outputDir: "./outputs/acme-rocket",
        }),
      });

      expect(response.status).toBe(202);
      expect(await response.json()).toEqual({ id: "job-1", status: "queued" });
    } finally {
      server.close();
    }
  });

  it("returns completed result paths for a finished job", async () => {
    const server = createServer({
      submitJob: async () => ({ id: "job-1", status: "queued" }),
      getJob: async (id) =>
        id === "job-1"
          ? {
              id,
              status: "completed",
              repoUrl: "https://github.com/acme/rocket",
              outputDir: "./outputs/acme-rocket",
              createdAt: "2026-04-15T00:00:00.000Z",
              updatedAt: "2026-04-15T00:00:01.000Z",
              paths: {
                analysisJson: "/tmp/analysis.json",
                reportHtml: "/tmp/report/index.html",
                runManifest: "/tmp/run-manifest.json",
              },
            }
          : null,
    });
    const baseUrl = await listen(server);

    try {
      const response = await fetch(`${baseUrl}/jobs/job-1/result`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        analysisJson: "/tmp/analysis.json",
        reportHtml: "/tmp/report/index.html",
        runManifest: "/tmp/run-manifest.json",
      });
    } finally {
      server.close();
    }
  });
});

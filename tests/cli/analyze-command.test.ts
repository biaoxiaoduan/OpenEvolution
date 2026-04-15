import { describe, expect, it, vi } from "vitest";
import { buildCli } from "../../src/cli.js";

describe("buildCli", () => {
  it("parses the analyze command into a normalized request", async () => {
    const runAnalyze = vi.fn().mockResolvedValue(undefined);
    const program = buildCli(runAnalyze);

    await program.parseAsync(
      [
        "node",
        "openevolution",
        "analyze",
        "https://github.com/vercel/next.js",
        "--output",
        "./outputs/next-js",
        "--since",
        "2023-01-01",
        "--model",
        "gpt-5.4-mini",
      ],
      { from: "user" },
    );

    expect(runAnalyze).toHaveBeenCalledWith({
      repoUrl: "https://github.com/vercel/next.js",
      outputDir: "./outputs/next-js",
      since: "2023-01-01",
      until: undefined,
      model: "gpt-5.4-mini",
      noCache: false,
      debug: false,
    });
  });

  it("leaves model undefined when the user does not pass one explicitly", async () => {
    const runAnalyze = vi.fn().mockResolvedValue(undefined);
    const program = buildCli(runAnalyze);

    await program.parseAsync(
      [
        "node",
        "openevolution",
        "analyze",
        "https://github.com/vercel/next.js",
        "--output",
        "./outputs/next-js",
      ],
      { from: "user" },
    );

    expect(runAnalyze).toHaveBeenCalledWith({
      repoUrl: "https://github.com/vercel/next.js",
      outputDir: "./outputs/next-js",
      since: undefined,
      until: undefined,
      model: undefined,
      noCache: false,
      debug: false,
    });
  });
});

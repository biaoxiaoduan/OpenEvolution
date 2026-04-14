import { describe, expect, it } from "vitest";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { createRunContext } from "../../src/core/run-context.js";

describe("createRunContext", () => {
  it("creates report and artifact directories under the output root", async () => {
    const context = await createRunContext({
      repoSlug: "vercel-next-js",
      outputDir: "./tmp/vercel-next-js",
      debug: true,
    });

    expect(context.paths.reportDir.endsWith("report")).toBe(true);
    expect(context.paths.artifactDir.endsWith("artifacts")).toBe(true);
    expect(context.paths.promptDir.endsWith("artifacts/prompts")).toBe(true);
    await expect(access(context.paths.reportDir, constants.F_OK)).resolves.toBeUndefined();
    await expect(access(context.paths.artifactDir, constants.F_OK)).resolves.toBeUndefined();
    await expect(access(context.paths.promptDir, constants.F_OK)).resolves.toBeUndefined();
  });
});

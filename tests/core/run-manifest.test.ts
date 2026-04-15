import { describe, expect, it } from "vitest";
import {
  createEmptyRunManifest,
  markRunFailed,
  markRunRunning,
  markStageComplete,
  markStageFailed,
  markStageRunning,
} from "../../src/core/run-manifest.js";

describe("run manifest", () => {
  it("tracks stage state and output paths", () => {
    const manifest = createEmptyRunManifest("acme-rocket");
    const running = markRunRunning(manifest);
    const stageRunning = markStageRunning(running, "time_buckets");
    const completed = markStageComplete(stageRunning, "time_buckets", {
      outputPath: "/tmp/acme-rocket/artifacts/time-buckets.json",
    });

    expect(completed.status).toBe("running");
    expect(completed.stages.time_buckets.status).toBe("completed");
    expect(completed.stages.time_buckets.outputPath).toBe(
      "/tmp/acme-rocket/artifacts/time-buckets.json",
    );
  });

  it("captures run and stage errors", () => {
    const manifest = createEmptyRunManifest("acme-rocket");
    const running = markStageRunning(markRunRunning(manifest), "analysis");
    const failedStage = markStageFailed(running, "analysis", {
      error: "provider timeout",
    });
    const failedRun = markRunFailed(failedStage, "analysis failed");

    expect(failedRun.status).toBe("failed");
    expect(failedRun.error).toBe("analysis failed");
    expect(failedRun.stages.analysis.status).toBe("failed");
    expect(failedRun.stages.analysis.error).toBe("provider timeout");
  });
});

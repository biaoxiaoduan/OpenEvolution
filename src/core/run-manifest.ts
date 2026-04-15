import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { writeJsonArtifact } from "./artifact-store.js";

export const RUN_STAGE_NAMES = [
  "collected",
  "time_buckets",
  "interpretations",
  "analysis",
  "report",
] as const;

export type RunStageName = (typeof RUN_STAGE_NAMES)[number];

type RunStatus = "queued" | "running" | "failed" | "completed";
type StageStatus = "pending" | "running" | "completed" | "failed";

export type RunManifest = {
  repoSlug: string;
  status: RunStatus;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  stages: Record<
    RunStageName,
    {
      status: StageStatus;
      outputPath?: string;
      error?: string;
    }
  >;
};

export function createEmptyRunManifest(repoSlug: string): RunManifest {
  return {
    repoSlug,
    status: "queued",
    stages: {
      collected: { status: "pending" },
      time_buckets: { status: "pending" },
      interpretations: { status: "pending" },
      analysis: { status: "pending" },
      report: { status: "pending" },
    },
  };
}

export function markRunRunning(manifest: RunManifest): RunManifest {
  return {
    ...manifest,
    status: "running",
    startedAt: manifest.startedAt ?? new Date().toISOString(),
    finishedAt: undefined,
    error: undefined,
  };
}

export function markRunCompleted(manifest: RunManifest): RunManifest {
  return {
    ...manifest,
    status: "completed",
    finishedAt: new Date().toISOString(),
    error: undefined,
  };
}

export function markRunFailed(
  manifest: RunManifest,
  error: string,
): RunManifest {
  return {
    ...manifest,
    status: "failed",
    finishedAt: new Date().toISOString(),
    error,
  };
}

export function markStageRunning(
  manifest: RunManifest,
  stage: RunStageName,
): RunManifest {
  return {
    ...manifest,
    stages: {
      ...manifest.stages,
      [stage]: {
        ...manifest.stages[stage],
        status: "running",
        error: undefined,
      },
    },
  };
}

export function markStageComplete(
  manifest: RunManifest,
  stage: RunStageName,
  input: { outputPath?: string },
): RunManifest {
  return {
    ...manifest,
    stages: {
      ...manifest.stages,
      [stage]: {
        status: "completed",
        outputPath: input.outputPath,
      },
    },
  };
}

export function markStageFailed(
  manifest: RunManifest,
  stage: RunStageName,
  input: { error: string },
): RunManifest {
  return {
    ...manifest,
    stages: {
      ...manifest.stages,
      [stage]: {
        ...manifest.stages[stage],
        status: "failed",
        error: input.error,
      },
    },
  };
}

export async function writeRunManifest(
  artifactDir: string,
  manifest: RunManifest,
): Promise<string> {
  return writeJsonArtifact(artifactDir, "run-manifest.json", manifest);
}

export async function readRunManifest(
  artifactDir: string,
): Promise<RunManifest | null> {
  try {
    const payload = await readFile(join(artifactDir, "run-manifest.json"), "utf8");
    return JSON.parse(payload) as RunManifest;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

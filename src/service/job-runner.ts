import { randomUUID } from "node:crypto";
import { analyzeRepository } from "../pipeline/analyze-repository.js";
import {
  createInMemoryJobStore,
  type JobRecord,
  type JobStore,
} from "./job-store.js";

type SubmitJobInput = {
  repoUrl: string;
  outputDir: string;
  model?: string;
  since?: string;
  until?: string;
  debug?: boolean;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createJobRunner(dependencies?: {
  store?: JobStore;
  runAnalysis?: typeof analyzeRepository;
}) {
  const store = dependencies?.store ?? createInMemoryJobStore();
  const runAnalysis = dependencies?.runAnalysis ?? analyzeRepository;

  return {
    async submitJob(input: SubmitJobInput) {
      const now = new Date().toISOString();
      const job: JobRecord = {
        id: randomUUID(),
        status: "queued",
        repoUrl: input.repoUrl,
        outputDir: input.outputDir,
        model: input.model,
        since: input.since,
        until: input.until,
        createdAt: now,
        updatedAt: now,
      };

      await store.create(job);

      queueMicrotask(async () => {
        await store.update(job.id, { status: "running" });

        try {
          const result = await runAnalysis({
            command: {
              repoUrl: input.repoUrl,
              outputDir: input.outputDir,
              since: input.since,
              until: input.until,
              model: input.model,
              noCache: false,
              debug: input.debug ?? false,
            },
          });

          await store.update(job.id, {
            status: "completed",
            paths: result.paths,
            error: undefined,
          });
        } catch (error) {
          await store.update(job.id, {
            status: "failed",
            error: getErrorMessage(error),
          });
        }
      });

      return {
        id: job.id,
        status: job.status,
      };
    },
    async getJob(id: string) {
      return store.get(id);
    },
  };
}

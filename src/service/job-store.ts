export type JobStatus = "queued" | "running" | "failed" | "completed";

export type JobPaths = {
  analysisJson?: string;
  reportHtml?: string;
  runManifest?: string;
};

export type JobRecord = {
  id: string;
  status: JobStatus;
  repoUrl: string;
  outputDir: string;
  model?: string;
  since?: string;
  until?: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
  paths?: JobPaths;
};

export type JobStore = {
  create(job: JobRecord): Promise<void>;
  update(id: string, patch: Partial<JobRecord>): Promise<JobRecord | null>;
  get(id: string): Promise<JobRecord | null>;
};

export function createInMemoryJobStore(): JobStore {
  const jobs = new Map<string, JobRecord>();

  return {
    async create(job) {
      jobs.set(job.id, job);
    },
    async update(id, patch) {
      const existing = jobs.get(id);

      if (!existing) {
        return null;
      }

      const updated: JobRecord = {
        ...existing,
        ...patch,
        paths: patch.paths ?? existing.paths,
        updatedAt: patch.updatedAt ?? new Date().toISOString(),
      };
      jobs.set(id, updated);
      return updated;
    },
    async get(id) {
      return jobs.get(id) ?? null;
    },
  };
}

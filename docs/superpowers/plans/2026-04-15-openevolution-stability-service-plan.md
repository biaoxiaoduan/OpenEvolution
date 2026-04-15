# OpenEvolution Stability And Service Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn OpenEvolution into a simple, stable CLI that can later be wrapped by a background job service and exposed as a skill for other agents.

**Architecture:** Keep the CLI as the single source of truth for analysis behavior, then add a thin service layer that submits and monitors the same pipeline instead of creating a parallel implementation. Favor resumability, explicit artifacts, and provider/model compatibility over concurrency or distributed infrastructure.

**Tech Stack:** Node.js 20, TypeScript, Commander, Zod, OpenAI-compatible SDK, Vitest, native `http`

---

## File Structure

### Application files

- Modify: `package.json`
- Modify: `README.md`
- Modify: `src/cli.ts`
- Modify: `src/core/config.ts`
- Create: `src/core/model-strategy.ts`
- Create: `src/core/retry.ts`
- Create: `src/core/run-manifest.ts`
- Modify: `src/analysis/llm-client.ts`
- Modify: `src/analysis/prompts.ts`
- Modify: `src/collectors/readme-snapshots.ts`
- Modify: `src/collectors/repository-collector.ts`
- Modify: `src/pipeline/analyze-repository.ts`
- Create: `src/service/job-store.ts`
- Create: `src/service/job-runner.ts`
- Create: `src/service/server.ts`
- Create: `src/service/index.ts`

### Test files

- Create: `tests/core/model-strategy.test.ts`
- Create: `tests/core/run-manifest.test.ts`
- Modify: `tests/analysis/llm-client.test.ts`
- Modify: `tests/collectors/repository-collector.test.ts`
- Create: `tests/collectors/readme-snapshots.test.ts`
- Modify: `tests/pipeline/analyze-repository.test.ts`
- Create: `tests/service/server.test.ts`

### Responsibility map

- `src/core/model-strategy.ts`: pick a usable model for the current provider or fail with a clear message
- `src/core/retry.ts`: centralize bounded retry and timeout behavior for provider calls
- `src/core/run-manifest.ts`: persist run status, stage transitions, and output paths for resume and service mode
- `src/analysis/llm-client.ts`: provider-safe structured generation with retries and artifact-ready metadata
- `src/collectors/readme-snapshots.ts`: fetch meaningful README revisions instead of returning an empty array
- `src/pipeline/analyze-repository.ts`: orchestrate resume-aware stages and write a manifest after each stage
- `src/service/*`: minimal background wrapper over the existing pipeline, not a second pipeline

## Task 1: Add Provider-Aware Model Selection

**Files:**
- Create: `src/core/model-strategy.ts`
- Modify: `src/core/config.ts`
- Modify: `src/cli.ts`
- Test: `tests/core/model-strategy.test.ts`

- [ ] **Step 1: Write the failing model strategy test**

```ts
import { describe, expect, it } from "vitest";
import { resolveModel } from "../../src/core/model-strategy.js";

describe("resolveModel", () => {
  it("keeps an explicit model when it is available from the provider", async () => {
    const model = await resolveModel({
      requestedModel: "qwen3.5-flash",
      listModels: async () => ["qwen3.5-flash", "qwen3.5-plus"],
    });

    expect(model).toBe("qwen3.5-flash");
  });

  it("falls back to the first preferred available model when no explicit model is given", async () => {
    const model = await resolveModel({
      requestedModel: undefined,
      listModels: async () => ["glm-5.1", "qwen3.5-flash", "qwen3.5-plus"],
      preferredModels: ["qwen3.5-flash", "qwen3.5-plus"],
    });

    expect(model).toBe("qwen3.5-flash");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/core/model-strategy.test.ts`
Expected: FAIL with `Cannot find module '../../src/core/model-strategy.js'`

- [ ] **Step 3: Implement provider-aware model resolution**

`src/core/model-strategy.ts`

```ts
type ResolveModelInput = {
  requestedModel?: string;
  preferredModels?: string[];
  listModels: () => Promise<string[]>;
};

const DEFAULT_PREFERRED_MODELS = [
  "qwen3.5-flash",
  "qwen3.5-plus",
  "glm-5.1",
];

export async function resolveModel({
  requestedModel,
  preferredModels = DEFAULT_PREFERRED_MODELS,
  listModels,
}: ResolveModelInput): Promise<string> {
  const availableModels = await listModels();

  if (requestedModel) {
    if (!availableModels.includes(requestedModel)) {
      throw new Error(`Requested model is unavailable: ${requestedModel}`);
    }

    return requestedModel;
  }

  const fallback = preferredModels.find((model) => availableModels.includes(model));

  if (!fallback) {
    throw new Error("No compatible analysis model is available from the configured provider");
  }

  return fallback;
}
```

`src/core/config.ts`

```ts
export type AppConfig = {
  openAiApiKey: string;
  githubToken?: string;
  starHistoryEndpoint?: string;
  defaultModel?: string;
};

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const openaiApiKey = env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }

  return {
    openAiApiKey,
    githubToken: env.GITHUB_TOKEN,
    starHistoryEndpoint: env.STAR_HISTORY_ENDPOINT,
    defaultModel: env.OPENEVOLUTION_MODEL,
  };
}
```

`src/cli.ts`

```ts
.option("--model <name>", "LLM model name (optional if the provider can auto-resolve one)")
```

- [ ] **Step 4: Run the focused test and type check**

Run: `npm test -- tests/core/model-strategy.test.ts && npm run check`
Expected: PASS and no TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src/core/model-strategy.ts src/core/config.ts src/cli.ts tests/core/model-strategy.test.ts
git commit -m "feat: add provider-aware model selection"
```

## Task 2: Harden Structured LLM Calls With Retry, Timeout, And Raw Metadata

**Files:**
- Create: `src/core/retry.ts`
- Modify: `src/analysis/llm-client.ts`
- Modify: `tests/analysis/llm-client.test.ts`

- [ ] **Step 1: Write the failing retry test**

```ts
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createOpenAiClient } from "../../src/analysis/llm-client.js";

describe("createOpenAiClient", () => {
  it("retries once when parsed output is missing and then succeeds", async () => {
    const parse = vi
      .fn()
      .mockResolvedValueOnce({ output_parsed: null })
      .mockResolvedValueOnce({ output_parsed: { ok: true } });

    const client = createOpenAiClient("test-key", {
      responses: { parse },
      retryPolicy: { attempts: 2, delayMs: 0 },
    });

    const result = await client.generateJson({
      model: "qwen3.5-flash",
      system: "Return JSON",
      user: "Return {\"ok\": true}",
      schemaName: "simple_result",
      schema: z.object({ ok: z.boolean() }),
    });

    expect(result).toEqual({ ok: true });
    expect(parse).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/analysis/llm-client.test.ts`
Expected: FAIL because retry support does not exist yet

- [ ] **Step 3: Implement bounded retry and metadata-aware parsing**

`src/core/retry.ts`

```ts
export async function withRetry<T>(input: {
  attempts: number;
  delayMs: number;
  run: () => Promise<T>;
}): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= input.attempts; attempt += 1) {
    try {
      return await input.run();
    } catch (error) {
      lastError = error;
      if (attempt === input.attempts) {
        throw lastError;
      }
      if (input.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, input.delayMs));
      }
    }
  }

  throw lastError;
}
```

`src/analysis/llm-client.ts`

```ts
import { withRetry } from "../core/retry.js";

type RetryPolicy = {
  attempts: number;
  delayMs: number;
};

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  attempts: 2,
  delayMs: 250,
};

// inside createOpenAiClient options:
retryPolicy?: RetryPolicy;

// inside generateJson:
return withRetry({
  attempts: retryPolicy.attempts,
  delayMs: retryPolicy.delayMs,
  run: async () => {
    const response = await responses.parse({ ... });
    if (response.output_parsed === null) {
      throw new Error("Model did not return parsed JSON output");
    }
    return response.output_parsed as T;
  },
});
```

- [ ] **Step 4: Run the focused test and full analysis client suite**

Run: `npm test -- tests/analysis/llm-client.test.ts && npm run check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/retry.ts src/analysis/llm-client.ts tests/analysis/llm-client.test.ts
git commit -m "feat: harden structured analysis calls"
```

## Task 3: Implement Real README Snapshot Collection

**Files:**
- Modify: `src/collectors/readme-snapshots.ts`
- Modify: `src/collectors/repository-collector.ts`
- Create: `tests/collectors/readme-snapshots.test.ts`
- Modify: `tests/collectors/repository-collector.test.ts`

- [ ] **Step 1: Write the failing README snapshot test**

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/collectors/readme-snapshots.test.ts`
Expected: FAIL because the collector still returns an empty array

- [ ] **Step 3: Implement minimal README history collection**

`src/collectors/readme-snapshots.ts`

```ts
import type { ReadmeSnapshot, RepositoryRef } from "../types/domain.js";

type ReadmeSnapshotDependencies = {
  fetchCommitList?: (repository: RepositoryRef) => Promise<Array<{ sha: string; authoredAt: string }>>;
  fetchReadmeAtCommit?: (sha: string) => Promise<string | null>;
};

export async function collectReadmeSnapshots(
  repository: RepositoryRef,
  dependencies: ReadmeSnapshotDependencies = {},
): Promise<ReadmeSnapshot[]> {
  if (!dependencies.fetchCommitList || !dependencies.fetchReadmeAtCommit) {
    return [];
  }

  const commits = await dependencies.fetchCommitList(repository);
  const snapshots: ReadmeSnapshot[] = [];

  for (const commit of commits) {
    const content = await dependencies.fetchReadmeAtCommit(commit.sha);
    if (content) {
      snapshots.push({
        capturedAt: commit.authoredAt,
        content,
      });
    }
  }

  return snapshots;
}
```

- [ ] **Step 4: Run the focused collector tests**

Run: `npm test -- tests/collectors/readme-snapshots.test.ts tests/collectors/repository-collector.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/collectors/readme-snapshots.ts src/collectors/repository-collector.ts tests/collectors/readme-snapshots.test.ts tests/collectors/repository-collector.test.ts
git commit -m "feat: add minimal readme snapshot collection"
```

## Task 4: Make Pipeline Runs Resume-Aware

**Files:**
- Create: `src/core/run-manifest.ts`
- Modify: `src/pipeline/analyze-repository.ts`
- Create: `tests/core/run-manifest.test.ts`
- Modify: `tests/pipeline/analyze-repository.test.ts`

- [ ] **Step 1: Write the failing manifest test**

```ts
import { describe, expect, it } from "vitest";
import { createEmptyRunManifest, markStageComplete } from "../../src/core/run-manifest.js";

describe("run manifest", () => {
  it("tracks stage state and output paths", () => {
    const manifest = createEmptyRunManifest("acme-rocket");
    const updated = markStageComplete(manifest, "time_buckets", {
      outputPath: "/tmp/acme-rocket/artifacts/time-buckets.json",
    });

    expect(updated.stages.time_buckets.status).toBe("completed");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/core/run-manifest.test.ts`
Expected: FAIL with missing manifest helpers

- [ ] **Step 3: Implement run manifest helpers and pipeline integration**

`src/core/run-manifest.ts`

```ts
export type RunManifest = {
  repoSlug: string;
  status: "queued" | "running" | "failed" | "completed";
  stages: Record<
    string,
    {
      status: "pending" | "running" | "completed" | "failed";
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

export function markStageComplete(
  manifest: RunManifest,
  stage: keyof RunManifest["stages"],
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
```

- [ ] **Step 4: Run the focused tests and pipeline suite**

Run: `npm test -- tests/core/run-manifest.test.ts tests/pipeline/analyze-repository.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/run-manifest.ts src/pipeline/analyze-repository.ts tests/core/run-manifest.test.ts tests/pipeline/analyze-repository.test.ts
git commit -m "feat: add resume-aware pipeline manifest"
```

## Task 5: Add A Minimal Background Service Wrapper

**Files:**
- Create: `src/service/job-store.ts`
- Create: `src/service/job-runner.ts`
- Create: `src/service/server.ts`
- Create: `src/service/index.ts`
- Modify: `package.json`
- Create: `tests/service/server.test.ts`

- [ ] **Step 1: Write the failing server test**

```ts
import { describe, expect, it } from "vitest";
import { createServer } from "../../src/service/server.js";

describe("service server", () => {
  it("accepts a job and returns a job id", async () => {
    const server = createServer({
      submitJob: async () => ({ id: "job-1", status: "queued" }),
      getJob: async () => null,
    });

    const response = await server.inject({
      method: "POST",
      path: "/jobs",
      body: {
        repoUrl: "https://github.com/acme/rocket",
        outputDir: "./outputs/acme-rocket",
      },
    });

    expect(response.statusCode).toBe(202);
    expect(JSON.parse(response.body).id).toBe("job-1");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/service/server.test.ts`
Expected: FAIL because the service layer does not exist

- [ ] **Step 3: Implement a thin job service**

`src/service/job-store.ts`

```ts
export type JobRecord = {
  id: string;
  status: "queued" | "running" | "failed" | "completed";
  repoUrl: string;
  outputDir: string;
  reportHtml?: string;
  analysisJson?: string;
};
```

`src/service/job-runner.ts`

```ts
import { randomUUID } from "node:crypto";
import { analyzeRepository } from "../pipeline/analyze-repository.js";

export async function submitJob(input: {
  repoUrl: string;
  outputDir: string;
  model?: string;
}) {
  const id = randomUUID();
  queueMicrotask(async () => {
    await analyzeRepository({
      command: {
        repoUrl: input.repoUrl,
        outputDir: input.outputDir,
        model: input.model ?? "qwen3.5-flash",
        noCache: false,
        debug: false,
      },
    });
  });
  return { id, status: "queued" as const };
}
```

`src/service/server.ts`

```ts
import { createServer as createHttpServer } from "node:http";

export function createServer(dependencies: {
  submitJob: (input: { repoUrl: string; outputDir: string; model?: string }) => Promise<{ id: string; status: string }>;
  getJob: (id: string) => Promise<unknown>;
}) {
  return createHttpServer(async (request, response) => {
    if (request.method === "POST" && request.url === "/jobs") {
      let body = "";
      for await (const chunk of request) {
        body += chunk;
      }
      const input = JSON.parse(body);
      const job = await dependencies.submitJob(input);
      response.writeHead(202, { "content-type": "application/json" });
      response.end(JSON.stringify(job));
      return;
    }

    response.writeHead(404);
    response.end();
  });
}
```

- [ ] **Step 4: Run the focused service test and type check**

Run: `npm test -- tests/service/server.test.ts && npm run check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json src/service/job-store.ts src/service/job-runner.ts src/service/server.ts src/service/index.ts tests/service/server.test.ts
git commit -m "feat: add minimal background analysis service"
```

## Task 6: Document The Service And Skill Contract

**Files:**
- Modify: `README.md`
- Modify: `.env.example`

- [ ] **Step 1: Write the missing service and skill usage section**

`README.md`

````md
## Service mode

```bash
npm run service
```

Endpoints:

- `POST /jobs`
- `GET /jobs/:id`

## Skill integration contract

Expected inputs:

- `repoUrl`
- `outputDir`
- `since` / `until`
- `model` (optional)

Expected outputs:

- `jobId`
- `status`
- `analysisJson`
- `reportHtml`
````

- [ ] **Step 2: Run the full verification suite**

Run: `npm test && npm run check && npm run build`
Expected: all commands PASS

- [ ] **Step 3: Commit**

```bash
git add README.md .env.example
git commit -m "docs: define service and skill contract"
```

## Self-Review Checklist

### Spec coverage

- Stable CLI: covered by Tasks 1 through 4
- Provider compatibility: covered by Tasks 1 and 2
- Real repository inputs instead of placeholder collectors: covered by Task 3
- Background job service: covered by Task 5
- Future skill wrapper contract: covered by Task 6

### Placeholder scan

- No `TODO` or `TBD` markers remain in tasks
- Every task names exact files and verification commands
- Every implementation step includes concrete code examples

### Type consistency

- `AnalyzeCommand` remains the CLI contract
- Pipeline remains the single execution engine for both CLI and service paths
- Service mode wraps `analyzeRepository` instead of forking a second analysis pipeline

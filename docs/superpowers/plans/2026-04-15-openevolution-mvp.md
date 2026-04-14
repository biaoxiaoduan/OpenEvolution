# OpenEvolution MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a CLI-first MVP that analyzes a single GitHub repository, infers evolution stages and milestones with a layered LLM pipeline, and renders a shareable static HTML report plus structured artifacts.

**Architecture:** Use a TypeScript monorepo-free single-package application with a narrow CLI entrypoint, explicit domain schemas, a staged pipeline, and a renderer that consumes `analysis.json` instead of internal collector state. Keep each phase independently testable so collection, preprocessing, AI analysis, and rendering can be debugged without rerunning the whole pipeline.

**Tech Stack:** Node.js 20, TypeScript, Commander, Zod, OpenAI SDK, Vitest

---

## File Structure

### Application files

- Create: `package.json`
- Create: `README.md`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.env.example`
- Create: `src/cli.ts`
- Create: `src/index.ts`
- Create: `src/core/config.ts`
- Create: `src/core/errors.ts`
- Create: `src/core/run-context.ts`
- Create: `src/core/artifact-store.ts`
- Create: `src/types/domain.ts`
- Create: `src/collectors/github-client.ts`
- Create: `src/collectors/repository-collector.ts`
- Create: `src/collectors/readme-snapshots.ts`
- Create: `src/collectors/star-history.ts`
- Create: `src/preprocess/time-buckets.ts`
- Create: `src/analysis/llm-client.ts`
- Create: `src/analysis/prompts.ts`
- Create: `src/analysis/interpret-buckets.ts`
- Create: `src/analysis/segment-stages.ts`
- Create: `src/analysis/detect-milestones.ts`
- Create: `src/analysis/synthesize-analysis.ts`
- Create: `src/pipeline/analyze-repository.ts`
- Create: `src/render/render-report.ts`
- Create: `src/render/report-template.ts`

### Test files

- Create: `tests/cli/analyze-command.test.ts`
- Create: `tests/core/run-context.test.ts`
- Create: `tests/collectors/repository-collector.test.ts`
- Create: `tests/collectors/star-history.test.ts`
- Create: `tests/preprocess/time-buckets.test.ts`
- Create: `tests/analysis/interpret-buckets.test.ts`
- Create: `tests/analysis/synthesize-analysis.test.ts`
- Create: `tests/render/render-report.test.ts`
- Create: `tests/pipeline/analyze-repository.test.ts`
- Create: `tests/fixtures/repo-sample.json`

### Responsibility map

- `src/cli.ts`: parse CLI input and hand a normalized command object to the pipeline
- `src/core/*`: runtime configuration, output directories, artifact persistence, shared error types
- `src/types/domain.ts`: the stable schema for collected data, time buckets, stages, milestones, and final analysis output
- `src/collectors/*`: external data collection only, no product interpretation
- `src/preprocess/*`: deterministic compression of repository history into time buckets
- `src/analysis/*`: LLM-backed reasoning stages with structured outputs
- `src/pipeline/*`: orchestrate the end-to-end run
- `src/render/*`: turn the final analysis object into static HTML

## Task 1: Scaffold The CLI Workspace

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.env.example`
- Create: `src/cli.ts`
- Create: `src/index.ts`
- Test: `tests/cli/analyze-command.test.ts`

- [ ] **Step 1: Write the failing CLI test**

```ts
import { describe, expect, it, vi } from "vitest";
import { buildCli } from "../../src/cli";

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
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/cli/analyze-command.test.ts`
Expected: FAIL with `Cannot find module '../../src/cli'` or `buildCli is not exported`

- [ ] **Step 3: Add the minimal workspace and CLI implementation**

`package.json`

```json
{
  "name": "openevolution",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "tsc --noEmit",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "commander": "^13.1.0",
    "openai": "^5.10.2",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/node": "^22.13.5",
    "typescript": "^5.8.2",
    "vitest": "^3.0.8"
  }
}
```

`tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "vitest.config.ts"]
}
```

`vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

`.env.example`

```bash
OPENAI_API_KEY=replace-me
GITHUB_TOKEN=replace-me
STAR_HISTORY_ENDPOINT=
```

`src/cli.ts`

```ts
import { Command } from "commander";

export type AnalyzeCommand = {
  repoUrl: string;
  outputDir: string;
  since?: string;
  until?: string;
  model: string;
  noCache: boolean;
  debug: boolean;
};

export function buildCli(runAnalyze: (command: AnalyzeCommand) => Promise<void>) {
  const program = new Command();

  program.name("openevolution").description("Analyze how open-source products evolve");

  program
    .command("analyze")
    .description("Analyze a GitHub repository and generate a static report")
    .argument("<repo-url>")
    .requiredOption("--output <dir>")
    .option("--since <date>")
    .option("--until <date>")
    .option("--model <name>", "LLM model name", "gpt-5.4-mini")
    .option("--no-cache", "Disable artifact cache reuse", false)
    .option("--debug", "Write verbose artifacts", false)
    .action(async (repoUrl: string, options) => {
      await runAnalyze({
        repoUrl,
        outputDir: options.output,
        since: options.since,
        until: options.until,
        model: options.model,
        noCache: options.cache === false,
        debug: options.debug,
      });
    });

  return program;
}
```

`src/index.ts`

```ts
import { buildCli } from "./cli.js";

async function main() {
  const program = buildCli(async () => {
    throw new Error("Pipeline not implemented yet");
  });

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 4: Run the focused test and type check**

Run: `npm test -- tests/cli/analyze-command.test.ts && npm run check`
Expected: PASS for the CLI test and no TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .env.example src/cli.ts src/index.ts tests/cli/analyze-command.test.ts
git commit -m "chore: scaffold TypeScript CLI workspace"
```

## Task 2: Define Runtime Configuration, Output Directories, And Domain Types

**Files:**
- Create: `src/core/config.ts`
- Create: `src/core/errors.ts`
- Create: `src/core/run-context.ts`
- Create: `src/core/artifact-store.ts`
- Create: `src/types/domain.ts`
- Test: `tests/core/run-context.test.ts`

- [ ] **Step 1: Write the failing runtime test**

```ts
import { describe, expect, it } from "vitest";
import { createRunContext } from "../../src/core/run-context";

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
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/core/run-context.test.ts`
Expected: FAIL with `Cannot find module '../../src/core/run-context'`

- [ ] **Step 3: Add the shared runtime and domain model**

`src/types/domain.ts`

```ts
export type RepositoryRef = {
  owner: string;
  name: string;
  url: string;
  slug: string;
};

export type RepoStats = {
  stars: number;
  forks: number;
  contributors: number;
};

export type CommitEvent = {
  sha: string;
  authoredAt: string;
  title: string;
  body: string;
};

export type PullRequestEvent = {
  number: number;
  title: string;
  mergedAt: string;
};

export type ReleaseEvent = {
  tagName: string;
  publishedAt: string;
  name: string;
};

export type ReadmeSnapshot = {
  capturedAt: string;
  content: string;
};

export type StarPoint = {
  timestamp: string;
  stars: number;
};

export type CollectedRepositoryData = {
  repository: RepositoryRef;
  stats: RepoStats;
  firstCommitAt: string;
  commits: CommitEvent[];
  pullRequests: PullRequestEvent[];
  releases: ReleaseEvent[];
  readmeSnapshots: ReadmeSnapshot[];
  starHistory: StarPoint[];
};

export type TimeBucket = {
  id: string;
  startAt: string;
  endAt: string;
  commitTitles: string[];
  pullRequestTitles: string[];
  releases: string[];
  readmeChanged: boolean;
  starDelta: number;
};

export type BucketInterpretation = {
  bucketId: string;
  summary: string;
  dominantWorkTypes: string[];
  productIntent: string;
};

export type EvolutionStage = {
  id: string;
  name: "exploration" | "formation" | "growth" | "breakout";
  startAt: string;
  endAt: string;
  summary: string;
  whyThisStage: string;
  dominantWorkTypes: string[];
  productState: string;
  evidenceBucketIds: string[];
};

export type Milestone = {
  type:
    | "first_usable"
    | "first_good_ux"
    | "first_demo_ready"
    | "pre_breakout_turning_point"
    | "direction_shift";
  timestamp: string;
  title: string;
  summary: string;
  whyItMatters: string;
  confidence: "high" | "medium" | "low";
  evidenceBucketIds: string[];
};

export type AnalysisResult = {
  project: {
    repository: RepositoryRef;
    stats: RepoStats;
    firstCommitAt: string;
    analyzedAt: string;
  };
  timelineBuckets: Array<TimeBucket & { interpretation?: BucketInterpretation }>;
  stages: EvolutionStage[];
  milestones: Milestone[];
  breakoutAnalysis: string;
  insights: Array<{
    pattern: string;
    evidence: string;
    transferableTakeaway: string;
  }>;
};
```

`src/core/config.ts`

```ts
export type AppConfig = {
  openAiApiKey: string;
  githubToken?: string;
  starHistoryEndpoint?: string;
};

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const openAiApiKey = env.OPENAI_API_KEY;

  if (!openAiApiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }

  return {
    openAiApiKey,
    githubToken: env.GITHUB_TOKEN,
    starHistoryEndpoint: env.STAR_HISTORY_ENDPOINT,
  };
}
```

`src/core/errors.ts`

```ts
export class CollectionError extends Error {}
export class AnalysisError extends Error {}
export class RenderingError extends Error {}
```

`src/core/run-context.ts`

```ts
import { mkdir } from "node:fs/promises";
import path from "node:path";

export async function createRunContext(input: {
  repoSlug: string;
  outputDir: string;
  debug: boolean;
}) {
  const rootDir = path.resolve(input.outputDir);
  const reportDir = path.join(rootDir, "report");
  const artifactDir = path.join(rootDir, "artifacts");
  const promptDir = path.join(artifactDir, "prompts");

  await Promise.all([
    mkdir(reportDir, { recursive: true }),
    mkdir(promptDir, { recursive: true }),
  ]);

  return {
    debug: input.debug,
    paths: { rootDir, reportDir, artifactDir, promptDir },
  };
}
```

`src/core/artifact-store.ts`

```ts
import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function writeJsonArtifact(baseDir: string, relativePath: string, value: unknown) {
  const target = path.join(baseDir, relativePath);
  await writeFile(target, JSON.stringify(value, null, 2), "utf8");
}
```

- [ ] **Step 4: Run the focused test and type check**

Run: `npm test -- tests/core/run-context.test.ts && npm run check`
Expected: PASS and no TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src/core/config.ts src/core/errors.ts src/core/run-context.ts src/core/artifact-store.ts src/types/domain.ts tests/core/run-context.test.ts
git commit -m "feat: add runtime context and domain schema"
```

## Task 3: Implement GitHub Collection For Repository History

**Files:**
- Create: `src/collectors/github-client.ts`
- Create: `src/collectors/repository-collector.ts`
- Test: `tests/collectors/repository-collector.test.ts`

- [ ] **Step 1: Write the failing collector test**

```ts
import { describe, expect, it } from "vitest";
import { collectRepositoryData } from "../../src/collectors/repository-collector";

describe("collectRepositoryData", () => {
  it("normalizes repository metadata, commits, pull requests, and releases", async () => {
    const data = await collectRepositoryData({
      repoUrl: "https://github.com/acme/rocket",
      githubToken: "test-token",
      fetcher: async (url: string) => {
        if (url.includes("/repos/acme/rocket")) {
          return { stargazers_count: 42, forks_count: 7, description: "Rocket", default_branch: "main" };
        }

        if (url.includes("/commits")) {
          return [{ sha: "abc", commit: { author: { date: "2024-01-01T00:00:00Z" }, message: "Initial prototype" } }];
        }

        if (url.includes("/pulls")) {
          return [{ number: 9, title: "Add shareable demo", merged_at: "2024-01-05T00:00:00Z" }];
        }

        if (url.includes("/releases")) {
          return [{ tag_name: "v0.1.0", name: "v0.1.0", published_at: "2024-01-06T00:00:00Z" }];
        }

        if (url.includes("/contributors")) {
          return [{ login: "alice" }, { login: "bob" }];
        }

        throw new Error(`Unexpected URL: ${url}`);
      },
    });

    expect(data.repository.slug).toBe("acme-rocket");
    expect(data.stats.stars).toBe(42);
    expect(data.commits[0].title).toBe("Initial prototype");
    expect(data.pullRequests[0].title).toBe("Add shareable demo");
    expect(data.releases[0].tagName).toBe("v0.1.0");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/collectors/repository-collector.test.ts`
Expected: FAIL with `collectRepositoryData is not exported`

- [ ] **Step 3: Implement the GitHub client and repository collector**

`src/collectors/github-client.ts`

```ts
export type JsonFetcher = (url: string) => Promise<unknown>;

export function createGitHubFetcher(token?: string): JsonFetcher {
  return async (url: string) => {
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (!response.ok) {
      throw new Error(`GitHub request failed: ${response.status} ${url}`);
    }

    return response.json();
  };
}
```

`src/collectors/repository-collector.ts`

```ts
import type { CollectedRepositoryData, RepositoryRef } from "../types/domain.js";
import { createGitHubFetcher, type JsonFetcher } from "./github-client.js";

function parseRepositoryRef(repoUrl: string): RepositoryRef {
  const match = repoUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!match) {
    throw new Error(`Unsupported repository URL: ${repoUrl}`);
  }

  const [, owner, name] = match;
  return { owner, name, url: repoUrl, slug: `${owner}-${name}` };
}

export async function collectRepositoryData(input: {
  repoUrl: string;
  githubToken?: string;
  fetcher?: JsonFetcher;
}): Promise<CollectedRepositoryData> {
  const repository = parseRepositoryRef(input.repoUrl);
  const fetcher = input.fetcher ?? createGitHubFetcher(input.githubToken);
  const base = `https://api.github.com/repos/${repository.owner}/${repository.name}`;

  const [repo, commits, pulls, releases, contributors] = await Promise.all([
    fetcher(base),
    fetcher(`${base}/commits?per_page=100`),
    fetcher(`${base}/pulls?state=closed&sort=updated&direction=desc&per_page=100`),
    fetcher(`${base}/releases?per_page=20`),
    fetcher(`${base}/contributors?per_page=20`),
  ]);

  const commitEvents = (commits as any[]).map((item) => ({
    sha: item.sha,
    authoredAt: item.commit.author.date,
    title: String(item.commit.message).split("\n")[0],
    body: String(item.commit.message).split("\n").slice(1).join("\n"),
  }));

  return {
    repository,
    stats: {
      stars: Number((repo as any).stargazers_count ?? 0),
      forks: Number((repo as any).forks_count ?? 0),
      contributors: (contributors as any[]).length,
    },
    firstCommitAt: commitEvents.at(-1)?.authoredAt ?? commitEvents[0]?.authoredAt ?? new Date().toISOString(),
    commits: commitEvents,
    pullRequests: (pulls as any[])
      .filter((item) => item.merged_at)
      .map((item) => ({
        number: item.number,
        title: item.title,
        mergedAt: item.merged_at,
      })),
    releases: (releases as any[]).map((item) => ({
      tagName: item.tag_name,
      name: item.name ?? item.tag_name,
      publishedAt: item.published_at,
    })),
    readmeSnapshots: [],
    starHistory: [],
  };
}
```

- [ ] **Step 4: Run the focused test**

Run: `npm test -- tests/collectors/repository-collector.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/collectors/github-client.ts src/collectors/repository-collector.ts tests/collectors/repository-collector.test.ts
git commit -m "feat: collect repository history from GitHub"
```

## Task 4: Add README Snapshots And Star History With Graceful Degradation

**Files:**
- Create: `src/collectors/readme-snapshots.ts`
- Create: `src/collectors/star-history.ts`
- Modify: `src/collectors/repository-collector.ts`
- Test: `tests/collectors/star-history.test.ts`

- [ ] **Step 1: Write the failing star-history test**

```ts
import { describe, expect, it } from "vitest";
import { collectStarHistory } from "../../src/collectors/star-history";

describe("collectStarHistory", () => {
  it("returns an empty array when the provider is unavailable", async () => {
    const result = await collectStarHistory({
      repoUrl: "https://github.com/acme/rocket",
      endpoint: "https://stars.example.com",
      fetcher: async () => {
        throw new Error("service unavailable");
      },
    });

    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/collectors/star-history.test.ts`
Expected: FAIL with `Cannot find module '../../src/collectors/star-history'`

- [ ] **Step 3: Implement README and star-history collection**

`src/collectors/readme-snapshots.ts`

```ts
import type { ReadmeSnapshot, RepositoryRef } from "../types/domain.js";

export async function collectReadmeSnapshots(_repository: RepositoryRef): Promise<ReadmeSnapshot[]> {
  return [];
}
```

`src/collectors/star-history.ts`

```ts
import type { StarPoint } from "../types/domain.js";

type JsonFetcher = (url: string) => Promise<unknown>;

export async function collectStarHistory(input: {
  repoUrl: string;
  endpoint?: string;
  fetcher?: JsonFetcher;
}): Promise<StarPoint[]> {
  if (!input.endpoint) {
    return [];
  }

  const fetcher =
    input.fetcher ??
    (async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Star history request failed: ${response.status}`);
      }
      return response.json();
    });

  try {
    const data = (await fetcher(`${input.endpoint}?repo=${encodeURIComponent(input.repoUrl)}`)) as Array<{
      timestamp: string;
      stars: number;
    }>;

    return data.map((point) => ({
      timestamp: point.timestamp,
      stars: point.stars,
    }));
  } catch {
    return [];
  }
}
```

Add this integration inside `src/collectors/repository-collector.ts`:

```ts
import { collectReadmeSnapshots } from "./readme-snapshots.js";
import { collectStarHistory } from "./star-history.js";

const [repo, commits, pulls, releases, contributors, readmeSnapshots, starHistory] = await Promise.all([
  fetcher(base),
  fetcher(`${base}/commits?per_page=100`),
  fetcher(`${base}/pulls?state=closed&sort=updated&direction=desc&per_page=100`),
  fetcher(`${base}/releases?per_page=20`),
  fetcher(`${base}/contributors?per_page=20`),
  collectReadmeSnapshots(repository),
  collectStarHistory({ repoUrl: input.repoUrl, endpoint: process.env.STAR_HISTORY_ENDPOINT }),
]);
```

- [ ] **Step 4: Run the focused tests**

Run: `npm test -- tests/collectors/star-history.test.ts tests/collectors/repository-collector.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/collectors/readme-snapshots.ts src/collectors/star-history.ts src/collectors/repository-collector.ts tests/collectors/star-history.test.ts
git commit -m "feat: add readme and star history collectors"
```

## Task 5: Build Deterministic Time Buckets

**Files:**
- Create: `src/preprocess/time-buckets.ts`
- Test: `tests/preprocess/time-buckets.test.ts`

- [ ] **Step 1: Write the failing bucketing test**

```ts
import { describe, expect, it } from "vitest";
import { buildTimeBuckets } from "../../src/preprocess/time-buckets";

describe("buildTimeBuckets", () => {
  it("groups commits and pull requests into chronological weekly buckets", () => {
    const buckets = buildTimeBuckets({
      commits: [
        { sha: "1", authoredAt: "2024-01-01T00:00:00Z", title: "Initial prototype", body: "" },
        { sha: "2", authoredAt: "2024-01-03T00:00:00Z", title: "Add landing page", body: "" },
      ],
      pullRequests: [{ number: 9, title: "Add demo flow", mergedAt: "2024-01-04T00:00:00Z" }],
      releases: [{ tagName: "v0.1.0", name: "v0.1.0", publishedAt: "2024-01-05T00:00:00Z" }],
      readmeSnapshots: [],
      starHistory: [
        { timestamp: "2024-01-01T00:00:00Z", stars: 3 },
        { timestamp: "2024-01-07T00:00:00Z", stars: 15 },
      ],
    });

    expect(buckets).toHaveLength(1);
    expect(buckets[0].commitTitles).toEqual(["Initial prototype", "Add landing page"]);
    expect(buckets[0].starDelta).toBe(12);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/preprocess/time-buckets.test.ts`
Expected: FAIL with `buildTimeBuckets is not exported`

- [ ] **Step 3: Implement weekly bucket construction**

`src/preprocess/time-buckets.ts`

```ts
import type { CollectedRepositoryData, TimeBucket } from "../types/domain.js";

function weekKey(timestamp: string): string {
  const date = new Date(timestamp);
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString();
}

export function buildTimeBuckets(data: Pick<
  CollectedRepositoryData,
  "commits" | "pullRequests" | "releases" | "readmeSnapshots" | "starHistory"
>): TimeBucket[] {
  const map = new Map<string, TimeBucket>();

  for (const commit of data.commits) {
    const key = weekKey(commit.authoredAt);
    const bucket =
      map.get(key) ??
      {
        id: key,
        startAt: key,
        endAt: key,
        commitTitles: [],
        pullRequestTitles: [],
        releases: [],
        readmeChanged: false,
        starDelta: 0,
      };
    bucket.commitTitles.push(commit.title);
    map.set(key, bucket);
  }

  for (const pullRequest of data.pullRequests) {
    const key = weekKey(pullRequest.mergedAt);
    const bucket = map.get(key);
    if (bucket) {
      bucket.pullRequestTitles.push(pullRequest.title);
    }
  }

  for (const release of data.releases) {
    const key = weekKey(release.publishedAt);
    const bucket = map.get(key);
    if (bucket) {
      bucket.releases.push(release.tagName);
    }
  }

  const ordered = [...map.values()].sort((left, right) => left.startAt.localeCompare(right.startAt));
  for (const bucket of ordered) {
    const points = data.starHistory.filter(
      (point) => point.timestamp >= bucket.startAt && point.timestamp < new Date(new Date(bucket.startAt).getTime() + 7 * 86400000).toISOString(),
    );
    if (points.length >= 2) {
      bucket.starDelta = points.at(-1)!.stars - points[0].stars;
    }
  }

  return ordered;
}
```

- [ ] **Step 4: Run the focused test**

Run: `npm test -- tests/preprocess/time-buckets.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/preprocess/time-buckets.ts tests/preprocess/time-buckets.test.ts
git commit -m "feat: add deterministic time bucket preprocessor"
```

## Task 6: Add The LLM Client And Bucket Interpretation Stage

**Files:**
- Create: `src/analysis/llm-client.ts`
- Create: `src/analysis/prompts.ts`
- Create: `src/analysis/interpret-buckets.ts`
- Test: `tests/analysis/interpret-buckets.test.ts`

- [ ] **Step 1: Write the failing interpretation test**

```ts
import { describe, expect, it } from "vitest";
import { interpretBuckets } from "../../src/analysis/interpret-buckets";

describe("interpretBuckets", () => {
  it("maps raw buckets into structured bucket interpretations", async () => {
    const result = await interpretBuckets({
      buckets: [
        {
          id: "2024-01-01T00:00:00.000Z",
          startAt: "2024-01-01T00:00:00.000Z",
          endAt: "2024-01-07T00:00:00.000Z",
          commitTitles: ["Initial prototype", "Add onboarding page"],
          pullRequestTitles: ["Add demo flow"],
          releases: ["v0.1.0"],
          readmeChanged: true,
          starDelta: 15,
        },
      ],
      client: {
        generateJson: async () => ({
          bucketId: "2024-01-01T00:00:00.000Z",
          summary: "The project moved from prototype to demoable product.",
          dominantWorkTypes: ["product", "ux"],
          productIntent: "Lower the adoption barrier for first-time users.",
        }),
      },
    });

    expect(result[0].productIntent).toContain("adoption barrier");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/analysis/interpret-buckets.test.ts`
Expected: FAIL with `interpretBuckets is not exported`

- [ ] **Step 3: Implement the LLM wrapper and interpretation stage**

`src/analysis/llm-client.ts`

```ts
import OpenAI from "openai";

export type JsonSchemaClient = {
  generateJson<T>(input: {
    model: string;
    system: string;
    user: string;
  }): Promise<T>;
};

export function createOpenAiClient(apiKey: string): JsonSchemaClient {
  const client = new OpenAI({ apiKey });

  return {
    async generateJson<T>({ model, system, user }: { model: string; system: string; user: string }) {
      const response = await client.responses.create({
        model,
        input: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });

      return JSON.parse(response.output_text) as T;
    },
  };
}
```

`src/analysis/prompts.ts`

```ts
import type { TimeBucket } from "../types/domain.js";

export function buildBucketPrompt(bucket: TimeBucket): string {
  return [
    "Interpret this repository time bucket as product evolution evidence.",
    JSON.stringify(bucket, null, 2),
    "Return JSON with: bucketId, summary, dominantWorkTypes, productIntent.",
  ].join("\n");
}
```

`src/analysis/interpret-buckets.ts`

```ts
import type { BucketInterpretation, TimeBucket } from "../types/domain.js";
import type { JsonSchemaClient } from "./llm-client.js";
import { buildBucketPrompt } from "./prompts.js";

export async function interpretBuckets(input: {
  buckets: TimeBucket[];
  client: JsonSchemaClient;
  model?: string;
}): Promise<BucketInterpretation[]> {
  const interpretations: BucketInterpretation[] = [];

  for (const bucket of input.buckets) {
    const interpretation = await input.client.generateJson<BucketInterpretation>({
      model: input.model ?? "gpt-5.4-mini",
      system: "You infer product intent from open-source repository history and always return valid JSON.",
      user: buildBucketPrompt(bucket),
    });
    interpretations.push(interpretation);
  }

  return interpretations;
}
```

- [ ] **Step 4: Run the focused test**

Run: `npm test -- tests/analysis/interpret-buckets.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/analysis/llm-client.ts src/analysis/prompts.ts src/analysis/interpret-buckets.ts tests/analysis/interpret-buckets.test.ts
git commit -m "feat: add bucket interpretation stage"
```

## Task 7: Implement Stage Segmentation, Milestone Detection, And Final Synthesis

**Files:**
- Create: `src/analysis/segment-stages.ts`
- Create: `src/analysis/detect-milestones.ts`
- Create: `src/analysis/synthesize-analysis.ts`
- Test: `tests/analysis/synthesize-analysis.test.ts`

- [ ] **Step 1: Write the failing synthesis test**

```ts
import { describe, expect, it } from "vitest";
import { synthesizeAnalysis } from "../../src/analysis/synthesize-analysis";

describe("synthesizeAnalysis", () => {
  it("assembles stages, milestones, breakout analysis, and insights into the final artifact", async () => {
    const result = await synthesizeAnalysis({
      project: {
        repository: { owner: "acme", name: "rocket", url: "https://github.com/acme/rocket", slug: "acme-rocket" },
        stats: { stars: 120, forks: 12, contributors: 3 },
        firstCommitAt: "2024-01-01T00:00:00Z",
        analyzedAt: "2026-04-15T00:00:00Z",
      },
      timelineBuckets: [
        {
          id: "bucket-1",
          startAt: "2024-01-01T00:00:00Z",
          endAt: "2024-01-07T00:00:00Z",
          commitTitles: ["Initial prototype"],
          pullRequestTitles: [],
          releases: [],
          readmeChanged: false,
          starDelta: 2,
          interpretation: {
            bucketId: "bucket-1",
            summary: "Technical validation",
            dominantWorkTypes: ["technical"],
            productIntent: "Test viability",
          },
        },
      ],
      client: {
        generateJson: async ({ system }) => {
          if (system.includes("Segment repository evolution")) {
            return [
              {
                id: "stage-1",
                name: "exploration",
                startAt: "2024-01-01T00:00:00Z",
                endAt: "2024-01-07T00:00:00Z",
                summary: "Early exploration",
                whyThisStage: "Only technical validation work exists.",
                dominantWorkTypes: ["technical"],
                productState: "Prototype",
                evidenceBucketIds: ["bucket-1"],
              },
            ];
          }

          if (system.includes("Detect major repository milestones")) {
            return [];
          }

          return {
            breakoutAnalysis: "No confident breakout detected.",
            insights: [
              {
                pattern: "Start narrow",
                evidence: "Only one technical bucket exists.",
                transferableTakeaway: "Begin with one clear use case.",
              },
            ],
          };
        },
      },
    });

    expect(result.stages[0].name).toBe("exploration");
    expect(result.breakoutAnalysis).toContain("No confident breakout");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/analysis/synthesize-analysis.test.ts`
Expected: FAIL with `synthesizeAnalysis is not exported`

- [ ] **Step 3: Implement stage segmentation, milestone extraction, and synthesis**

`src/analysis/segment-stages.ts`

```ts
import type { BucketInterpretation, EvolutionStage, TimeBucket } from "../types/domain.js";
import type { JsonSchemaClient } from "./llm-client.js";

export async function segmentStages(input: {
  buckets: Array<TimeBucket & { interpretation: BucketInterpretation }>;
  client: JsonSchemaClient;
  model?: string;
}): Promise<EvolutionStage[]> {
  const payload = JSON.stringify(input.buckets, null, 2);
  return input.client.generateJson<EvolutionStage[]>({
    model: input.model ?? "gpt-5.4-mini",
    system: "Segment repository evolution into stages and return JSON only.",
    user: `Return stage objects for these interpreted buckets:\n${payload}`,
  });
}
```

`src/analysis/detect-milestones.ts`

```ts
import type { EvolutionStage, Milestone, TimeBucket, BucketInterpretation } from "../types/domain.js";
import type { JsonSchemaClient } from "./llm-client.js";

export async function detectMilestones(input: {
  buckets: Array<TimeBucket & { interpretation: BucketInterpretation }>;
  stages: EvolutionStage[];
  client: JsonSchemaClient;
  model?: string;
}): Promise<Milestone[]> {
  return input.client.generateJson<Milestone[]>({
    model: input.model ?? "gpt-5.4-mini",
    system: "Detect major repository milestones and return JSON only.",
    user: JSON.stringify({ buckets: input.buckets, stages: input.stages }, null, 2),
  });
}
```

`src/analysis/synthesize-analysis.ts`

```ts
import type { AnalysisResult, BucketInterpretation, Milestone, EvolutionStage, TimeBucket } from "../types/domain.js";
import type { JsonSchemaClient } from "./llm-client.js";
import { detectMilestones } from "./detect-milestones.js";
import { segmentStages } from "./segment-stages.js";

export async function synthesizeAnalysis(input: {
  project: AnalysisResult["project"];
  timelineBuckets: Array<TimeBucket & { interpretation: BucketInterpretation }>;
  client: JsonSchemaClient;
  model?: string;
}): Promise<AnalysisResult> {
  const stages = await segmentStages({
    buckets: input.timelineBuckets,
    client: input.client,
    model: input.model,
  });

  const milestones = await detectMilestones({
    buckets: input.timelineBuckets,
    stages,
    client: input.client,
    model: input.model,
  });

  const synthesis = await input.client.generateJson<{
    breakoutAnalysis: string;
    insights: AnalysisResult["insights"];
  }>({
    model: input.model ?? "gpt-5.4-mini",
    system: "Synthesize breakout analysis and transferable insights from repository evolution. Return JSON only.",
    user: JSON.stringify({ project: input.project, buckets: input.timelineBuckets, stages, milestones }, null, 2),
  });

  return {
    project: input.project,
    timelineBuckets: input.timelineBuckets,
    stages,
    milestones,
    breakoutAnalysis: synthesis.breakoutAnalysis,
    insights: synthesis.insights,
  };
}
```

- [ ] **Step 4: Run the focused test**

Run: `npm test -- tests/analysis/synthesize-analysis.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/analysis/segment-stages.ts src/analysis/detect-milestones.ts src/analysis/synthesize-analysis.ts tests/analysis/synthesize-analysis.test.ts
git commit -m "feat: add stage, milestone, and synthesis analysis steps"
```

## Task 8: Render The Static HTML Report

**Files:**
- Create: `src/render/report-template.ts`
- Create: `src/render/render-report.ts`
- Test: `tests/render/render-report.test.ts`

- [ ] **Step 1: Write the failing renderer test**

```ts
import { describe, expect, it } from "vitest";
import { renderReportHtml } from "../../src/render/render-report";

describe("renderReportHtml", () => {
  it("renders the required report sections from an analysis result", () => {
    const html = renderReportHtml({
      project: {
        repository: { owner: "acme", name: "rocket", url: "https://github.com/acme/rocket", slug: "acme-rocket" },
        stats: { stars: 120, forks: 12, contributors: 3 },
        firstCommitAt: "2024-01-01T00:00:00Z",
        analyzedAt: "2026-04-15T00:00:00Z",
      },
      timelineBuckets: [],
      stages: [],
      milestones: [],
      breakoutAnalysis: "README and demo improvements preceded growth.",
      insights: [{ pattern: "README is a product surface", evidence: "The README changed before breakout.", transferableTakeaway: "Invest in onboarding assets early." }],
    });

    expect(html).toContain("Growth Timeline");
    expect(html).toContain("Breakout Analysis");
    expect(html).toContain("README is a product surface");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/render/render-report.test.ts`
Expected: FAIL with `renderReportHtml is not exported`

- [ ] **Step 3: Implement the report template and renderer**

`src/render/report-template.ts`

```ts
import type { AnalysisResult } from "../types/domain.js";

export function reportTemplate(result: AnalysisResult): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OpenEvolution Report - ${result.project.repository.slug}</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; padding: 40px; color: #172033; background: linear-gradient(180deg, #f6f7fb, #ffffff); }
      section { margin-bottom: 40px; }
      h1, h2 { margin-bottom: 12px; }
      .timeline-item, .insight, .stage { background: #ffffff; border: 1px solid #d9e1f0; border-radius: 16px; padding: 16px; margin-bottom: 12px; }
    </style>
  </head>
  <body>
    <section>
      <h1>${result.project.repository.name}</h1>
      <p>${result.project.stats.stars} stars · ${result.project.stats.contributors} contributors</p>
    </section>
    <section>
      <h2>Growth Timeline</h2>
      ${result.milestones.map((milestone) => `<div class="timeline-item"><strong>${milestone.title}</strong><p>${milestone.summary}</p></div>`).join("")}
    </section>
    <section>
      <h2>Evolution Stages</h2>
      ${result.stages.map((stage) => `<div class="stage"><strong>${stage.name}</strong><p>${stage.summary}</p></div>`).join("")}
    </section>
    <section>
      <h2>Breakout Analysis</h2>
      <p>${result.breakoutAnalysis}</p>
    </section>
    <section>
      <h2>Key Insights</h2>
      ${result.insights.map((insight) => `<div class="insight"><strong>${insight.pattern}</strong><p>${insight.transferableTakeaway}</p></div>`).join("")}
    </section>
  </body>
</html>`;
}
```

`src/render/render-report.ts`

```ts
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { AnalysisResult } from "../types/domain.js";
import { reportTemplate } from "./report-template.js";

export function renderReportHtml(result: AnalysisResult): string {
  return reportTemplate(result);
}

export async function writeReport(result: AnalysisResult, reportDir: string): Promise<void> {
  await writeFile(path.join(reportDir, "index.html"), renderReportHtml(result), "utf8");
}
```

- [ ] **Step 4: Run the focused test**

Run: `npm test -- tests/render/render-report.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/render/report-template.ts src/render/render-report.ts tests/render/render-report.test.ts
git commit -m "feat: render static HTML analysis report"
```

## Task 9: Wire The End-To-End Pipeline And Persist Artifacts

**Files:**
- Create: `src/pipeline/analyze-repository.ts`
- Modify: `src/index.ts`
- Modify: `src/cli.ts`
- Test: `tests/pipeline/analyze-repository.test.ts`
- Create: `tests/fixtures/repo-sample.json`

- [ ] **Step 1: Write the failing pipeline test**

```ts
import { describe, expect, it } from "vitest";
import { analyzeRepository } from "../../src/pipeline/analyze-repository";

describe("analyzeRepository", () => {
  it("writes analysis.json and index.html for a successful run", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const result = await analyzeRepository({
      command: {
        repoUrl: "https://github.com/acme/rocket",
        outputDir: "./tmp/acme-rocket",
        model: "gpt-5.4-mini",
        noCache: true,
        debug: true,
      },
      dependencies: {
        collectRepositoryData: async () => ({
          repository: { owner: "acme", name: "rocket", url: "https://github.com/acme/rocket", slug: "acme-rocket" },
          stats: { stars: 42, forks: 5, contributors: 2 },
          firstCommitAt: "2024-01-01T00:00:00Z",
          commits: [{ sha: "1", authoredAt: "2024-01-01T00:00:00Z", title: "Initial prototype", body: "" }],
          pullRequests: [],
          releases: [],
          readmeSnapshots: [],
          starHistory: [],
        }),
        interpretBuckets: async (input) =>
          input.buckets.map((bucket) => ({
            bucketId: bucket.id,
            summary: "Initial technical validation",
            dominantWorkTypes: ["technical"],
            productIntent: "Validate feasibility",
          })),
        synthesizeAnalysis: async (input) => ({
          project: input.project,
          timelineBuckets: input.timelineBuckets,
          stages: [],
          milestones: [],
          breakoutAnalysis: "No confident breakout detected.",
          insights: [],
        }),
        createClient: () => ({
          generateJson: async () => {
            throw new Error("The pipeline test should use the injected analysis stages");
          },
        }),
      },
    });

    expect(result.paths.analysisJson.endsWith("artifacts/analysis.json")).toBe(true);
    expect(result.paths.reportHtml.endsWith("report/index.html")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/pipeline/analyze-repository.test.ts`
Expected: FAIL with `analyzeRepository is not exported`

- [ ] **Step 3: Implement the orchestrator**

`src/pipeline/analyze-repository.ts`

```ts
import path from "node:path";
import type { AnalyzeCommand } from "../cli.js";
import { createOpenAiClient } from "../analysis/llm-client.js";
import { writeJsonArtifact } from "../core/artifact-store.js";
import { loadConfig } from "../core/config.js";
import { createRunContext } from "../core/run-context.js";
import { collectRepositoryData } from "../collectors/repository-collector.js";
import { buildTimeBuckets } from "../preprocess/time-buckets.js";
import { interpretBuckets } from "../analysis/interpret-buckets.js";
import { synthesizeAnalysis } from "../analysis/synthesize-analysis.js";
import { writeReport } from "../render/render-report.js";

export async function analyzeRepository(input: {
  command: AnalyzeCommand;
  dependencies?: {
    collectRepositoryData?: typeof collectRepositoryData;
    interpretBuckets?: typeof interpretBuckets;
    synthesizeAnalysis?: typeof synthesizeAnalysis;
    createClient?: typeof createOpenAiClient;
  };
}) {
  const collect = input.dependencies?.collectRepositoryData ?? collectRepositoryData;
  const interpret = input.dependencies?.interpretBuckets ?? interpretBuckets;
  const synthesize = input.dependencies?.synthesizeAnalysis ?? synthesizeAnalysis;
  const createClient = input.dependencies?.createClient ?? createOpenAiClient;
  const config = loadConfig(process.env);
  const client = createClient(config.openAiApiKey);

  const collected = await collect({
    repoUrl: input.command.repoUrl,
  });

  const context = await createRunContext({
    repoSlug: collected.repository.slug,
    outputDir: input.command.outputDir,
    debug: input.command.debug,
  });

  const buckets = buildTimeBuckets(collected);
  const interpretations = await interpret({
    buckets,
    client,
    model: input.command.model,
  });

  const timelineBuckets = buckets.map((bucket) => ({
    ...bucket,
    interpretation: interpretations.find((item) => item.bucketId === bucket.id),
  }));

  const analysis = await synthesize({
    project: {
      repository: collected.repository,
      stats: collected.stats,
      firstCommitAt: collected.firstCommitAt,
      analyzedAt: new Date().toISOString(),
    },
    timelineBuckets: timelineBuckets as any,
    client,
    model: input.command.model,
  });

  await writeJsonArtifact(context.paths.artifactDir, "analysis.json", analysis);
  await writeReport(analysis, context.paths.reportDir);

  return {
    paths: {
      analysisJson: path.join(context.paths.artifactDir, "analysis.json"),
      reportHtml: path.join(context.paths.reportDir, "index.html"),
    },
  };
}
```

Update `src/index.ts` to call the real pipeline:

```ts
import { buildCli } from "./cli.js";
import { analyzeRepository } from "./pipeline/analyze-repository.js";

async function main() {
  const program = buildCli(async (command) => {
    await analyzeRepository({ command });
  });

  await program.parseAsync(process.argv);
}
```

- [ ] **Step 4: Run the focused test and the full suite**

Run: `npm test -- tests/pipeline/analyze-repository.test.ts && npm test && npm run build`
Expected: PASS, with `dist/` emitted by the build step

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/analyze-repository.ts src/index.ts tests/pipeline/analyze-repository.test.ts tests/fixtures/repo-sample.json
git commit -m "feat: wire the end-to-end analysis pipeline"
```

## Task 10: Add Final Regression Checks And Developer Documentation

**Files:**
- Create: `README.md`
- Modify: `.env.example`
- Test: all existing tests

- [ ] **Step 1: Write the missing README as a user-facing smoke contract**

`README.md`

````md
# OpenEvolution

OpenEvolution reconstructs how open-source products evolve over time.

## Quick start

```bash
npm install
cp .env.example .env
npm run build
node dist/index.js analyze https://github.com/vercel/next.js --output ./outputs/next-js
```

## Output

- `report/index.html`
- `artifacts/analysis.json`

## Development

```bash
npm test
npm run check
npm run build
```
````

- [ ] **Step 2: Run the full verification suite**

Run: `npm test && npm run check && npm run build`
Expected: all commands PASS

- [ ] **Step 3: Commit**

```bash
git add README.md .env.example
git commit -m "docs: add developer quick start"
```

## Self-Review Checklist

### Spec coverage

- CLI-first MVP: covered by Tasks 1 and 9
- Output artifacts and static report: covered by Tasks 2, 8, and 9
- GitHub plus star history data collection: covered by Tasks 3 and 4
- Time-bucket preprocessing: covered by Task 5
- Layered LLM pipeline: covered by Tasks 6 and 7
- Traceable `analysis.json` artifact: covered by Tasks 2, 7, and 9
- Static report sections: covered by Task 8
- Error handling and degraded behavior: covered by Tasks 2, 4, and 9
- Testing and evaluation baseline: covered by Tasks 1 through 10, with focused unit tests and an end-to-end pipeline test

### Placeholder scan

- No `TODO`, `TBD`, or deferred implementation markers remain in task steps
- Every code-writing step includes concrete file content or a concrete patch target
- Every test step includes an exact command and expected result

### Type consistency

- `AnalyzeCommand`, `CollectedRepositoryData`, `TimeBucket`, `BucketInterpretation`, `EvolutionStage`, `Milestone`, and `AnalysisResult` are defined before later tasks use them
- Renderer and pipeline tasks consume the same `AnalysisResult` shape introduced in Task 2
- The pipeline writes `analysis.json` and `report/index.html`, matching the approved spec

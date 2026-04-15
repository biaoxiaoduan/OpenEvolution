import { join } from "node:path";
import type { AnalyzeCommand } from "../cli.js";
import { createOpenAiClient, type JsonSchemaClient } from "../analysis/llm-client.js";
import { interpretBuckets } from "../analysis/interpret-buckets.js";
import { synthesizeAnalysis } from "../analysis/synthesize-analysis.js";
import { collectRepositoryData } from "../collectors/repository-collector.js";
import { readJsonFile, writeJsonArtifact } from "../core/artifact-store.js";
import { loadConfig } from "../core/config.js";
import { resolveModel } from "../core/model-strategy.js";
import { createRunContext } from "../core/run-context.js";
import {
  createEmptyRunManifest,
  markRunCompleted,
  markRunFailed,
  markRunRunning,
  markStageComplete,
  markStageFailed,
  markStageRunning,
  type RunManifest,
  type RunStageName,
  readRunManifest,
  writeRunManifest,
} from "../core/run-manifest.js";
import { buildTimeBuckets } from "../preprocess/time-buckets.js";
import { writeReport } from "../render/render-report.js";
import type { AnalysisResult, BucketInterpretation } from "../types/domain.js";

type AnalyzeRepositoryDependencies = {
  collectRepositoryData?: typeof collectRepositoryData;
  interpretBuckets?: typeof interpretBuckets;
  synthesizeAnalysis?: typeof synthesizeAnalysis;
  createClient?: (apiKey: string) => JsonSchemaClient;
};

function deriveRepoSlug(repoUrl: string): string {
  const url = new URL(repoUrl);
  const segments = url.pathname.split("/").filter(Boolean);

  if (!["github.com", "www.github.com"].includes(url.hostname) || segments.length < 2) {
    throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
  }

  const [owner, rawName] = segments;
  const name = rawName.endsWith(".git") ? rawName.slice(0, -4) : rawName;

  return `${owner}-${name}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function tryReuseCompletedRun(input: {
  command: AnalyzeCommand;
  artifactDir: string;
}): Promise<{
  runManifest: string;
  analysisJson: string;
  reportHtml: string;
  analysis: AnalysisResult;
} | null> {
  if (input.command.noCache) {
    return null;
  }

  const manifest = await readRunManifest(input.artifactDir);

  if (
    !manifest ||
    manifest.status !== "completed" ||
    !manifest.stages.analysis.outputPath ||
    !manifest.stages.report.outputPath
  ) {
    return null;
  }

  try {
    const analysis = await readJsonFile<AnalysisResult>(
      manifest.stages.analysis.outputPath,
    );

    return {
      runManifest: join(input.artifactDir, "run-manifest.json"),
      analysisJson: manifest.stages.analysis.outputPath,
      reportHtml: manifest.stages.report.outputPath,
      analysis,
    };
  } catch {
    return null;
  }
}

function isWithinRange(
  timestamp: string,
  since?: string,
  until?: string,
): boolean {
  if (since && timestamp < since) {
    return false;
  }

  if (until && timestamp > `${until}T23:59:59.999Z`) {
    return false;
  }

  return true;
}

function filterCollectedData(
  collected: Awaited<ReturnType<typeof collectRepositoryData>>,
  command: AnalyzeCommand,
): Awaited<ReturnType<typeof collectRepositoryData>> {
  if (!command.since && !command.until) {
    return collected;
  }

  const commits = collected.commits.filter((commit) =>
    isWithinRange(commit.authoredAt, command.since, command.until),
  );
  const pullRequests = collected.pullRequests.filter((pullRequest) =>
    isWithinRange(pullRequest.mergedAt, command.since, command.until),
  );
  const releases = collected.releases.filter(
    (release) =>
      !release.publishedAt ||
      isWithinRange(release.publishedAt, command.since, command.until),
  );
  const readmeSnapshots = collected.readmeSnapshots.filter((snapshot) =>
    isWithinRange(snapshot.capturedAt, command.since, command.until),
  );
  const starHistory = collected.starHistory.filter((point) =>
    isWithinRange(point.timestamp, command.since, command.until),
  );

  return {
    ...collected,
    firstCommitAt: commits[0]?.authoredAt ?? collected.firstCommitAt,
    commits,
    pullRequests,
    releases,
    readmeSnapshots,
    starHistory,
  };
}

export async function analyzeRepository(input: {
  command: AnalyzeCommand;
  dependencies?: AnalyzeRepositoryDependencies;
}): Promise<{
  paths: {
    analysisJson: string;
    reportHtml: string;
    runManifest: string;
  };
  analysis: AnalysisResult;
}> {
  const collect = input.dependencies?.collectRepositoryData ?? collectRepositoryData;
  const interpret = input.dependencies?.interpretBuckets ?? interpretBuckets;
  const synthesize = input.dependencies?.synthesizeAnalysis ?? synthesizeAnalysis;
  const createClient = input.dependencies?.createClient ?? createOpenAiClient;

  const context = await createRunContext({
    repoSlug: deriveRepoSlug(input.command.repoUrl),
    outputDir: input.command.outputDir,
    debug: input.command.debug,
  });
  const cachedRun = await tryReuseCompletedRun({
    command: input.command,
    artifactDir: context.paths.artifactDir,
  });

  if (cachedRun) {
    return {
      paths: {
        analysisJson: cachedRun.analysisJson,
        reportHtml: cachedRun.reportHtml,
        runManifest: cachedRun.runManifest,
      },
      analysis: cachedRun.analysis,
    };
  }

  const config = loadConfig(process.env);
  const client = createClient(config.openAiApiKey);
  const model = await resolveModel({
    requestedModel: input.command.model ?? config.defaultModel,
    listModels: () => client.listModels(),
  });

  let manifest: RunManifest = markRunRunning(
    createEmptyRunManifest(context.repoSlug),
  );
  const updateManifest = async (nextManifest: RunManifest): Promise<string> => {
    manifest = nextManifest;
    return writeRunManifest(context.paths.artifactDir, manifest);
  };

  let runManifest = await updateManifest(manifest);
  let activeStage: RunStageName | null = null;

  try {
    activeStage = "collected";
    runManifest = await updateManifest(markStageRunning(manifest, activeStage));
    const collected = filterCollectedData(
      await collect({
        repoUrl: input.command.repoUrl,
        githubToken: config.githubToken,
        starHistoryEndpoint: config.starHistoryEndpoint,
      }),
      input.command,
    );
    const collectedPath = await writeJsonArtifact(
      context.paths.artifactDir,
      "collected.json",
      collected,
    );
    runManifest = await updateManifest(
      markStageComplete(manifest, activeStage, { outputPath: collectedPath }),
    );

    activeStage = "time_buckets";
    runManifest = await updateManifest(markStageRunning(manifest, activeStage));
    const buckets = buildTimeBuckets(collected);
    const bucketsPath = await writeJsonArtifact(
      context.paths.artifactDir,
      "time-buckets.json",
      buckets,
    );
    runManifest = await updateManifest(
      markStageComplete(manifest, activeStage, { outputPath: bucketsPath }),
    );

    activeStage = "interpretations";
    runManifest = await updateManifest(markStageRunning(manifest, activeStage));
    const interpretations = await interpret({
      buckets,
      client,
      model,
    });
    const interpretationsPath = await writeJsonArtifact(
      context.paths.artifactDir,
      "bucket-interpretations.json",
      interpretations,
    );
    runManifest = await updateManifest(
      markStageComplete(manifest, activeStage, { outputPath: interpretationsPath }),
    );

    const interpretationMap = new Map<string, BucketInterpretation>(
      interpretations.map((interpretation) => [
        interpretation.bucketId,
        interpretation,
      ]),
    );

    const timelineBuckets = buckets
      .map((bucket) => ({
        ...bucket,
        interpretation: interpretationMap.get(bucket.id),
      }))
      .filter(
        (
          bucket,
        ): bucket is typeof bucket & { interpretation: BucketInterpretation } =>
          Boolean(bucket.interpretation),
      );

    activeStage = "analysis";
    runManifest = await updateManifest(markStageRunning(manifest, activeStage));
    const analysis = await synthesize({
      project: {
        repository: collected.repository,
        stats: collected.stats,
        firstCommitAt: collected.firstCommitAt,
        analyzedAt: new Date().toISOString(),
      },
      timelineBuckets,
      client,
      model,
    });

    const analysisJson = await writeJsonArtifact(
      context.paths.artifactDir,
      "analysis.json",
      analysis,
    );
    runManifest = await updateManifest(
      markStageComplete(manifest, activeStage, { outputPath: analysisJson }),
    );

    activeStage = "report";
    runManifest = await updateManifest(markStageRunning(manifest, activeStage));
    const reportHtml = await writeReport(analysis, context.paths.reportDir);
    runManifest = await updateManifest(
      markStageComplete(manifest, activeStage, { outputPath: reportHtml }),
    );
    runManifest = await updateManifest(markRunCompleted(manifest));

    return {
      paths: {
        analysisJson,
        reportHtml,
        runManifest,
      },
      analysis,
    };
  } catch (error) {
    if (activeStage) {
      manifest = markStageFailed(manifest, activeStage, {
        error: getErrorMessage(error),
      });
    }

    runManifest = await updateManifest(
      markRunFailed(manifest, getErrorMessage(error)),
    );
    throw error;
  }
}

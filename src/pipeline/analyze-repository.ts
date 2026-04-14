import { join } from "node:path";
import type { AnalyzeCommand } from "../cli.js";
import { createOpenAiClient, type JsonSchemaClient } from "../analysis/llm-client.js";
import { interpretBuckets } from "../analysis/interpret-buckets.js";
import { synthesizeAnalysis } from "../analysis/synthesize-analysis.js";
import { collectRepositoryData } from "../collectors/repository-collector.js";
import { writeJsonArtifact } from "../core/artifact-store.js";
import { loadConfig } from "../core/config.js";
import { createRunContext } from "../core/run-context.js";
import { buildTimeBuckets } from "../preprocess/time-buckets.js";
import { writeReport } from "../render/render-report.js";
import type { AnalysisResult, BucketInterpretation } from "../types/domain.js";

type AnalyzeRepositoryDependencies = {
  collectRepositoryData?: typeof collectRepositoryData;
  interpretBuckets?: typeof interpretBuckets;
  synthesizeAnalysis?: typeof synthesizeAnalysis;
  createClient?: (apiKey: string) => JsonSchemaClient;
};

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
  };
  analysis: AnalysisResult;
}> {
  const collect = input.dependencies?.collectRepositoryData ?? collectRepositoryData;
  const interpret = input.dependencies?.interpretBuckets ?? interpretBuckets;
  const synthesize = input.dependencies?.synthesizeAnalysis ?? synthesizeAnalysis;
  const createClient = input.dependencies?.createClient ?? createOpenAiClient;

  const config = loadConfig(process.env);
  const client = createClient(config.openAiApiKey);

  const collected = filterCollectedData(
    await collect({
      repoUrl: input.command.repoUrl,
      githubToken: config.githubToken,
      starHistoryEndpoint: config.starHistoryEndpoint,
    }),
    input.command,
  );

  const context = await createRunContext({
    repoSlug: collected.repository.slug,
    outputDir: input.command.outputDir,
    debug: input.command.debug,
  });

  await writeJsonArtifact(context.paths.artifactDir, "collected.json", collected);

  const buckets = buildTimeBuckets(collected);
  await writeJsonArtifact(context.paths.artifactDir, "time-buckets.json", buckets);

  const interpretations = await interpret({
    buckets,
    client,
    model: input.command.model,
  });
  await writeJsonArtifact(
    context.paths.artifactDir,
    "bucket-interpretations.json",
    interpretations,
  );

  const interpretationMap = new Map<string, BucketInterpretation>(
    interpretations.map((interpretation) => [interpretation.bucketId, interpretation]),
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

  const analysis = await synthesize({
    project: {
      repository: collected.repository,
      stats: collected.stats,
      firstCommitAt: collected.firstCommitAt,
      analyzedAt: new Date().toISOString(),
    },
    timelineBuckets,
    client,
    model: input.command.model,
  });

  const analysisJson = await writeJsonArtifact(
    context.paths.artifactDir,
    "analysis.json",
    analysis,
  );
  const reportHtml = await writeReport(analysis, context.paths.reportDir);

  return {
    paths: {
      analysisJson,
      reportHtml,
    },
    analysis,
  };
}

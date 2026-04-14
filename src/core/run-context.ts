import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

export type RunContext = {
  repoSlug: string;
  debug: boolean;
  paths: {
    rootDir: string;
    reportDir: string;
    artifactDir: string;
    promptDir: string;
  };
};

export type CreateRunContextOptions = {
  repoSlug: string;
  outputDir: string;
  debug: boolean;
};

export async function createRunContext({
  repoSlug,
  outputDir,
  debug,
}: CreateRunContextOptions): Promise<RunContext> {
  const rootDir = resolve(outputDir);
  const reportDir = join(rootDir, "report");
  const artifactDir = join(rootDir, "artifacts");
  const promptDir = join(artifactDir, "prompts");

  await mkdir(artifactDir, { recursive: true });
  await mkdir(reportDir, { recursive: true });
  await mkdir(promptDir, { recursive: true });

  return {
    repoSlug,
    debug,
    paths: {
      rootDir,
      reportDir,
      artifactDir,
      promptDir,
    },
  };
}

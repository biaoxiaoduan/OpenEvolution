import type { ReadmeSnapshot, RepositoryRef } from "../types/domain.js";

type ReadmeSnapshotDependencies = {
  fetchCommitList?: (
    repository: RepositoryRef,
  ) => Promise<Array<{ sha: string; authoredAt: string }>>;
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

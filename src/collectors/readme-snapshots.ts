import type { ReadmeSnapshot, RepositoryRef } from "../types/domain.js";

export async function collectReadmeSnapshots(
  _repository: RepositoryRef,
): Promise<ReadmeSnapshot[]> {
  return [];
}

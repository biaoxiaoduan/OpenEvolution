import type { StarPoint } from "../types/domain.js";

export type StarHistoryFetcher = (url: string) => Promise<unknown>;

type CollectStarHistoryInput = {
  repoUrl: string;
  endpoint?: string;
  fetcher?: StarHistoryFetcher;
};

export async function collectStarHistory({
  repoUrl,
  endpoint,
  fetcher,
}: CollectStarHistoryInput): Promise<StarPoint[]> {
  if (!endpoint) {
    return [];
  }

  const effectiveFetcher =
    fetcher ??
    (async (url: string) => {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Star history request failed: ${response.status}`);
      }

      return response.json();
    });

  try {
    const payload = await effectiveFetcher(
      `${endpoint}?repo=${encodeURIComponent(repoUrl)}`,
    );

    if (!Array.isArray(payload)) {
      return [];
    }

    return payload
      .filter((point): point is { timestamp: string; stars: number } => {
        return (
          typeof point === "object" &&
          point !== null &&
          typeof point.timestamp === "string" &&
          typeof point.stars === "number"
        );
      })
      .map((point) => ({
        timestamp: point.timestamp,
        stars: point.stars,
      }));
  } catch {
    return [];
  }
}

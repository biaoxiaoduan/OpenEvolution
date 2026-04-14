import type { CollectedRepositoryData, TimeBucket } from "../types/domain.js";

type BucketSeed = Omit<TimeBucket, "endAt"> & {
  endAt?: string;
};

function startOfWeek(timestamp: string): string {
  const date = new Date(timestamp);
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString();
}

function endOfWeek(startAt: string): string {
  const nextWeek = new Date(startAt);
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
  nextWeek.setUTCMilliseconds(nextWeek.getUTCMilliseconds() - 1);
  return nextWeek.toISOString();
}

function ensureBucket(map: Map<string, BucketSeed>, timestamp: string): BucketSeed {
  const key = startOfWeek(timestamp);
  const existing = map.get(key);

  if (existing) {
    return existing;
  }

  const bucket: BucketSeed = {
    id: key,
    startAt: key,
    commitTitles: [],
    pullRequestTitles: [],
    releases: [],
    readmeChanged: false,
    starDelta: 0,
  };

  map.set(key, bucket);
  return bucket;
}

export function buildTimeBuckets(
  data: Pick<
    CollectedRepositoryData,
    "commits" | "pullRequests" | "releases" | "readmeSnapshots" | "starHistory"
  >,
): TimeBucket[] {
  const buckets = new Map<string, BucketSeed>();

  for (const commit of data.commits) {
    ensureBucket(buckets, commit.authoredAt).commitTitles.push(commit.title);
  }

  for (const pullRequest of data.pullRequests) {
    ensureBucket(buckets, pullRequest.mergedAt).pullRequestTitles.push(
      pullRequest.title,
    );
  }

  for (const release of data.releases) {
    if (!release.publishedAt) {
      continue;
    }

    ensureBucket(buckets, release.publishedAt).releases.push(release.tagName);
  }

  for (const snapshot of data.readmeSnapshots) {
    ensureBucket(buckets, snapshot.capturedAt).readmeChanged = true;
  }

  const ordered = [...buckets.values()].sort((left, right) =>
    left.startAt.localeCompare(right.startAt),
  );

  return ordered.map((bucket) => {
    const endAt = endOfWeek(bucket.startAt);
    const points = data.starHistory.filter(
      (point) => point.timestamp >= bucket.startAt && point.timestamp <= endAt,
    );

    return {
      ...bucket,
      endAt,
      starDelta:
        points.length >= 2 ? points[points.length - 1].stars - points[0].stars : 0,
    };
  });
}

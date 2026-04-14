export type RepositoryRef = {
  owner: string;
  name: string;
  slug: string;
  url: string;
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
  url: string;
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

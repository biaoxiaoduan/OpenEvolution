export type RepositoryRef = {
  owner: string;
  name: string;
  slug: string;
  url: string;
};

export type RepoStats = {
  stars: number;
  forks: number;
  openIssues: number;
  closedIssues: number;
  openPullRequests: number;
  closedPullRequests: number;
  commits: number;
};

export type CommitEvent = {
  sha: string;
  message: string;
  author: string;
  committedAt: string;
  url: string;
};

export type PullRequestEvent = {
  number: number;
  title: string;
  state: "open" | "closed" | "merged";
  author: string;
  createdAt: string;
  mergedAt?: string;
  closedAt?: string;
  url: string;
};

export type ReleaseEvent = {
  tagName: string;
  name: string;
  publishedAt: string;
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
  description: string;
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

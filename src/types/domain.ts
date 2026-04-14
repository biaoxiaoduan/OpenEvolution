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
  sourceUrl?: string;
};

export type StarPoint = {
  date: string;
  stars: number;
};

export type CollectedRepositoryData = {
  repository: RepositoryRef;
  stats: RepoStats;
  commits: CommitEvent[];
  pullRequests: PullRequestEvent[];
  releases: ReleaseEvent[];
  readmeSnapshots: ReadmeSnapshot[];
  starHistory: StarPoint[];
};

export type TimeBucket = "day" | "week" | "month" | "quarter" | "year";

export type BucketInterpretation = {
  bucket: TimeBucket;
  label: string;
  summary: string;
  confidence: number;
};

export type EvolutionStage =
  | "bootstrap"
  | "adoption"
  | "growth"
  | "scale"
  | "maturity"
  | "decline";

export type Milestone = {
  id: string;
  title: string;
  description: string;
  date: string;
  stage: EvolutionStage;
  evidence: string[];
};

export type AnalysisResult = {
  repository: RepositoryRef;
  generatedAt: string;
  stage: EvolutionStage;
  summary: string;
  milestones: Milestone[];
  bucketInterpretations: BucketInterpretation[];
};

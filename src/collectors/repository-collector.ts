import type { CollectedRepositoryData, CommitEvent, PullRequestEvent, ReleaseEvent, RepositoryRef } from "../types/domain.js";
import { createGitHubFetcher, type JsonFetcher } from "./github-client.js";

type CollectRepositoryDataInput = {
  repoUrl: string;
  githubToken?: string;
  fetcher?: JsonFetcher;
};

type GitHubRepositoryResponse = {
  stargazers_count: number;
  forks_count: number;
};

type GitHubCommitResponse = {
  sha: string;
  commit: {
    author: {
      date: string;
    };
    message: string;
  };
};

type GitHubPullRequestResponse = {
  number: number;
  title: string;
  merged_at: string | null;
};

type GitHubReleaseResponse = {
  tag_name: string;
  name: string;
  published_at: string;
};

type GitHubContributorResponse = {
  login: string;
};

export async function collectRepositoryData({
  repoUrl,
  githubToken,
  fetcher = createGitHubFetcher(githubToken),
}: CollectRepositoryDataInput): Promise<CollectedRepositoryData> {
  const repository = parseRepositoryRef(repoUrl);

  const [repoResponse, commitResponses, pullRequestResponses, releaseResponses, contributorResponses] = await Promise.all([
    fetcher(`/repos/${repository.owner}/${repository.name}`) as Promise<GitHubRepositoryResponse>,
    fetcher(`/commits/${repository.owner}/${repository.name}`) as Promise<GitHubCommitResponse[]>,
    fetcher(`/pulls/${repository.owner}/${repository.name}?state=closed`) as Promise<GitHubPullRequestResponse[]>,
    fetcher(`/releases/${repository.owner}/${repository.name}`) as Promise<GitHubReleaseResponse[]>,
    fetcher(`/contributors/${repository.owner}/${repository.name}`) as Promise<GitHubContributorResponse[]>,
  ]);

  const commits = commitResponses.map(normalizeCommit);
  const pullRequests = pullRequestResponses
    .filter((pullRequest) => Boolean(pullRequest.merged_at))
    .map(normalizePullRequest);
  const releases = releaseResponses.map(normalizeRelease);

  return {
    repository,
    stats: {
      stars: repoResponse.stargazers_count,
      forks: repoResponse.forks_count,
      contributors: contributorResponses.length,
    },
    firstCommitAt: findFirstCommitAt(commits),
    commits,
    pullRequests,
    releases,
    readmeSnapshots: [],
    starHistory: [],
  };
}

function parseRepositoryRef(repoUrl: string): RepositoryRef {
  const url = new URL(repoUrl);
  const segments = url.pathname.split("/").filter(Boolean);

  if (url.hostname !== "github.com" || segments.length < 2) {
    throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
  }

  const [owner, name] = segments;

  return {
    owner,
    name,
    slug: `${owner}-${name}`,
    url: `https://github.com/${owner}/${name}`,
  };
}

function normalizeCommit(commit: GitHubCommitResponse): CommitEvent {
  const [title, ...bodyLines] = commit.commit.message.split("\n");

  return {
    sha: commit.sha,
    authoredAt: commit.commit.author.date,
    title,
    body: bodyLines.join("\n").trim(),
  };
}

function normalizePullRequest(pullRequest: GitHubPullRequestResponse): PullRequestEvent {
  return {
    number: pullRequest.number,
    title: pullRequest.title,
    mergedAt: pullRequest.merged_at ?? "",
  };
}

function normalizeRelease(release: GitHubReleaseResponse): ReleaseEvent {
  return {
    tagName: release.tag_name,
    name: release.name,
    publishedAt: release.published_at,
  };
}

function findFirstCommitAt(commits: CommitEvent[]): string {
  if (commits.length === 0) {
    return "";
  }

  return commits.reduce((earliest, commit) => {
    return commit.authoredAt < earliest ? commit.authoredAt : earliest;
  }, commits[0].authoredAt);
}

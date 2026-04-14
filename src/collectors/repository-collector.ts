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
  name: string | null;
  published_at: string | null;
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
  const basePath = `/${repository.owner}/${repository.name}`;

  const [repoResponse, commitResponses, pullRequestResponses, releaseResponses, contributorResponses] = await Promise.all([
    fetcher(`/repos/${repository.owner}/${repository.name}`) as Promise<GitHubRepositoryResponse>,
    fetchPaginatedResults<GitHubCommitResponse>(fetcher, `/commits${basePath}?per_page=100`),
    fetchPaginatedResults<GitHubPullRequestResponse>(fetcher, `/pulls${basePath}?state=closed&sort=updated&direction=desc&per_page=100`),
    fetchPaginatedResults<GitHubReleaseResponse>(fetcher, `/releases${basePath}?per_page=20`),
    fetchPaginatedResults<GitHubContributorResponse>(fetcher, `/contributors${basePath}?per_page=20`),
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

  if (!["github.com", "www.github.com"].includes(url.hostname) || segments.length < 2) {
    throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
  }

  const [owner, rawName] = segments;
  const name = rawName.endsWith(".git") ? rawName.slice(0, -4) : rawName;

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
    name: release.name || release.tag_name,
    publishedAt: release.published_at ?? "",
  };
}

function findFirstCommitAt(commits: CommitEvent[]): string {
  if (commits.length === 0) {
    return new Date().toISOString();
  }

  return commits.reduce((earliest, commit) => {
    return commit.authoredAt < earliest ? commit.authoredAt : earliest;
  }, commits[0].authoredAt);
}

async function fetchPaginatedResults<T>(fetcher: JsonFetcher, url: string): Promise<T[]> {
  const results: T[] = [];

  for (let page = 1; ; page += 1) {
    const pageResults = await fetcher(`${url}&page=${page}`);

    if (!Array.isArray(pageResults) || pageResults.length === 0) {
      return results;
    }

    results.push(...(pageResults as T[]));
  }
}

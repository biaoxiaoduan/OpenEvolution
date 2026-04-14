export type JsonFetcher = (url: string) => Promise<unknown>;

const GITHUB_API_BASE_URL = "https://api.github.com";

export function createGitHubFetcher(token?: string): JsonFetcher {
  return async (url: string) => {
    const response = await fetch(resolveGitHubUrl(url), {
      headers: {
        Accept: "application/vnd.github+json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  };
}

function resolveGitHubUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  const [path, query] = url.split("?");
  const normalizedPath = rewriteShortcutPath(path);

  return `${GITHUB_API_BASE_URL}${normalizedPath}${query ? `?${query}` : ""}`;
}

function rewriteShortcutPath(path: string): string {
  if (path.startsWith("/repos/")) {
    return path;
  }

  const segments = path.split("/").filter(Boolean);

  if (segments.length === 3) {
    const [resource, owner, repo] = segments;

    if (["commits", "pulls", "releases", "contributors"].includes(resource)) {
      return `/repos/${owner}/${repo}/${resource}`;
    }
  }

  return path;
}

export type AppConfig = {
  openaiApiKey: string;
  githubToken?: string;
  starHistoryEndpoint?: string;
};

type Environment = Record<string, string | undefined>;

export function loadConfig(env: Environment): AppConfig {
  const openaiApiKey = env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }

  return {
    openaiApiKey,
    githubToken: env.GITHUB_TOKEN,
    starHistoryEndpoint: env.STAR_HISTORY_ENDPOINT,
  };
}

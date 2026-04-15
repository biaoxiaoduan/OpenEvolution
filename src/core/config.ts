export type AppConfig = {
  openAiApiKey: string;
  githubToken?: string;
  starHistoryEndpoint?: string;
  defaultModel?: string;
};

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const openaiApiKey = env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }

  return {
    openAiApiKey: openaiApiKey,
    githubToken: env.GITHUB_TOKEN,
    starHistoryEndpoint: env.STAR_HISTORY_ENDPOINT,
    defaultModel: env.OPENEVOLUTION_MODEL,
  };
}

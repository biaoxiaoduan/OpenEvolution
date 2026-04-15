type ResolveModelInput = {
  requestedModel?: string;
  preferredModels?: string[];
  listModels: () => Promise<string[]>;
};

const DEFAULT_PREFERRED_MODELS = [
  "qwen3.5-flash",
  "qwen3.5-plus",
  "glm-5.1",
];

export async function resolveModel({
  requestedModel,
  preferredModels = DEFAULT_PREFERRED_MODELS,
  listModels,
}: ResolveModelInput): Promise<string> {
  const availableModels = await listModels();

  if (requestedModel) {
    if (!availableModels.includes(requestedModel)) {
      throw new Error(`Requested model is unavailable: ${requestedModel}`);
    }

    return requestedModel;
  }

  const fallback = preferredModels.find((model) =>
    availableModels.includes(model),
  );

  if (!fallback) {
    throw new Error(
      "No compatible analysis model is available from the configured provider",
    );
  }

  return fallback;
}

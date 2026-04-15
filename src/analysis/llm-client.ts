import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ZodType } from "zod";
import { withRetry } from "../core/retry.js";

export type JsonSchemaClient = {
  listModels(): Promise<string[]>;
  generateJson<T>(input: {
    model: string;
    system: string;
    user: string;
    schema: ZodType<T>;
    schemaName: string;
  }): Promise<T>;
};

type ParseableResponses = {
  parse: (input: Record<string, unknown>) => Promise<{ output_parsed: unknown }>;
};

type RetryPolicy = {
  attempts: number;
  delayMs: number;
};

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  attempts: 1,
  delayMs: 250,
};

export function createOpenAiClient(
  apiKey: string,
  options?: {
    responses?: ParseableResponses;
    retryPolicy?: RetryPolicy;
  },
): JsonSchemaClient {
  const client = new OpenAI({ apiKey });
  const responses = options?.responses ?? (client.responses as ParseableResponses);
  const retryPolicy = options?.retryPolicy ?? DEFAULT_RETRY_POLICY;

  return {
    async listModels() {
      const models = await client.models.list();
      return models.data.map((model) => model.id);
    },
    async generateJson<T>({
      model,
      system,
      user,
      schema,
      schemaName,
    }: {
      model: string;
      system: string;
      user: string;
      schema: ZodType<T>;
      schemaName: string;
    }) {
      return withRetry({
        attempts: retryPolicy.attempts,
        delayMs: retryPolicy.delayMs,
        run: async () => {
          const response = await responses.parse({
            model,
            input: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            text: {
              format: zodTextFormat(schema, schemaName),
            },
          });

          if (response.output_parsed === null) {
            throw new Error("Model did not return parsed JSON output");
          }

          return response.output_parsed as T;
        },
      });
    },
  };
}

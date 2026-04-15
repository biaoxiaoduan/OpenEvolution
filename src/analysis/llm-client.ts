import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ZodType } from "zod";

export type JsonSchemaClient = {
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

export function createOpenAiClient(
  apiKey: string,
  options?: {
    responses?: ParseableResponses;
  },
): JsonSchemaClient {
  const client = new OpenAI({ apiKey });
  const responses = options?.responses ?? (client.responses as ParseableResponses);

  return {
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
  };
}

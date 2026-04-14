import OpenAI from "openai";

export type JsonSchemaClient = {
  generateJson<T>(input: {
    model: string;
    system: string;
    user: string;
  }): Promise<T>;
};

export function createOpenAiClient(apiKey: string): JsonSchemaClient {
  const client = new OpenAI({ apiKey });

  return {
    async generateJson<T>({
      model,
      system,
      user,
    }: {
      model: string;
      system: string;
      user: string;
    }) {
      const response = await client.responses.create({
        model,
        input: [
          { role: "system", content: system },
          { role: "user", content: user },
        ] as any,
      });

      return JSON.parse(response.output_text) as T;
    },
  };
}

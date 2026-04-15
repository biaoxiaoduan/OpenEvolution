import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createOpenAiClient } from "../../src/analysis/llm-client.js";

describe("createOpenAiClient", () => {
  it("uses the responses parser with a structured text schema", async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: { ok: true },
    });

    const client = createOpenAiClient("test-key", {
      responses: { parse },
    });

    const result = await client.generateJson({
      model: "gpt-5.4-mini",
      system: "Return JSON.",
      user: "Return {\"ok\": true}",
      schemaName: "simple_result",
      schema: z.object({
        ok: z.boolean(),
      }),
    });

    expect(result).toEqual({ ok: true });
    expect(parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5.4-mini",
        text: expect.objectContaining({
          format: expect.objectContaining({
            type: "json_schema",
          }),
        }),
      }),
    );
  });

  it("throws when the API returns no parsed structured output", async () => {
    const client = createOpenAiClient("test-key", {
      responses: {
        parse: vi.fn().mockResolvedValue({
          output_parsed: null,
        }),
      },
    });

    await expect(
      client.generateJson({
        model: "gpt-5.4-mini",
        system: "Return JSON.",
        user: "Return {\"ok\": true}",
        schemaName: "simple_result",
        schema: z.object({
          ok: z.boolean(),
        }),
      }),
    ).rejects.toThrow("Model did not return parsed JSON output");
  });
});

import { describe, expect, it } from "vitest";
import { resolveModel } from "../../src/core/model-strategy.js";

describe("resolveModel", () => {
  it("keeps an explicit model when it is available from the provider", async () => {
    const model = await resolveModel({
      requestedModel: "qwen3.5-flash",
      listModels: async () => ["qwen3.5-flash", "qwen3.5-plus"],
    });

    expect(model).toBe("qwen3.5-flash");
  });

  it("falls back to the first preferred available model when no explicit model is given", async () => {
    const model = await resolveModel({
      requestedModel: undefined,
      listModels: async () => ["glm-5.1", "qwen3.5-flash", "qwen3.5-plus"],
      preferredModels: ["qwen3.5-flash", "qwen3.5-plus"],
    });

    expect(model).toBe("qwen3.5-flash");
  });
});

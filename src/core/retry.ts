export async function withRetry<T>(input: {
  attempts: number;
  delayMs: number;
  run: () => Promise<T>;
}): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= input.attempts; attempt += 1) {
    try {
      return await input.run();
    } catch (error) {
      lastError = error;

      if (attempt === input.attempts) {
        throw lastError;
      }

      if (input.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, input.delayMs));
      }
    }
  }

  throw lastError;
}

import { buildCli } from "./cli.js";
import { analyzeRepository } from "./pipeline/analyze-repository.js";

async function main() {
  const program = buildCli(async (command) => {
    await analyzeRepository({ command });
  });

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

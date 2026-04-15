import { Command } from "commander";

export type AnalyzeCommand = {
  repoUrl: string;
  outputDir: string;
  since?: string;
  until?: string;
  model?: string;
  noCache: boolean;
  debug: boolean;
};

export function buildCli(
  runAnalyze: (command: AnalyzeCommand) => Promise<void>,
) {
  const program = new Command();
  const parseAsync = program.parseAsync.bind(program);

  program
    .name("openevolution")
    .description("Analyze how open-source products evolve");

  program
    .command("analyze")
    .description("Analyze a GitHub repository and generate a static report")
    .argument("<repo-url>")
    .requiredOption("--output <dir>")
    .option("--since <date>")
    .option("--until <date>")
    .option(
      "--model <name>",
      "LLM model name (optional if the provider can auto-resolve one)",
    )
    .option("--no-cache", "Disable artifact cache reuse", false)
    .option("--debug", "Write verbose artifacts", false)
    .action(async (repoUrl: string, options) => {
      await runAnalyze({
        repoUrl,
        outputDir: options.output,
        since: options.since,
        until: options.until,
        model: options.model,
        noCache: options.noCache ?? false,
        debug: options.debug ?? false,
      });
    });

  program.parseAsync = (async (argv: string[], options?: any) => {
    const normalizedArgv =
      argv[0] === "node" && argv[1] === "openevolution" ? argv.slice(2) : argv;

    return parseAsync(normalizedArgv, options);
  }) as typeof program.parseAsync;

  return program;
}

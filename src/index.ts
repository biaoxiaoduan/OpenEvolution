import { buildCli } from "./cli.js";

async function main() {
  const program = buildCli(async () => {
    throw new Error("Pipeline not implemented yet");
  });

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

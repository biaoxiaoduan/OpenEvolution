import { createJobRunner } from "./job-runner.js";
import { createServer } from "./server.js";

const runner = createJobRunner();
const server = createServer(runner);
const port = Number(process.env.OPENEVOLUTION_SERVICE_PORT ?? "3030");

server.listen(port, () => {
  console.log(`OpenEvolution service listening on http://127.0.0.1:${port}`);
});

import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { JobRecord } from "./job-store.js";

type SubmitJobInput = {
  repoUrl: string;
  outputDir: string;
  model?: string;
  since?: string;
  until?: string;
};

type ServiceDependencies = {
  submitJob: (input: SubmitJobInput) => Promise<{ id: string; status: string }>;
  getJob: (id: string) => Promise<JobRecord | null>;
};

function writeJson(
  response: ServerResponse<IncomingMessage>,
  statusCode: number,
  payload: unknown,
): void {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(`${JSON.stringify(payload)}\n`);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  let payload = "";

  for await (const chunk of request) {
    payload += chunk;
  }

  return payload ? JSON.parse(payload) : {};
}

function isSubmitJobInput(value: unknown): value is SubmitJobInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (
    "repoUrl" in value &&
    typeof value.repoUrl === "string" &&
    "outputDir" in value &&
    typeof value.outputDir === "string"
  );
}

export function createServer(dependencies: ServiceDependencies) {
  return createHttpServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");

      if (request.method === "POST" && url.pathname === "/jobs") {
        const body = await readJsonBody(request);

        if (!isSubmitJobInput(body)) {
          writeJson(response, 400, { error: "repoUrl and outputDir are required" });
          return;
        }

        const job = await dependencies.submitJob(body);
        writeJson(response, 202, job);
        return;
      }

      const resultMatch = url.pathname.match(/^\/jobs\/([^/]+)\/result$/);
      if (request.method === "GET" && resultMatch) {
        const job = await dependencies.getJob(resultMatch[1]);

        if (!job) {
          writeJson(response, 404, { error: "Job not found" });
          return;
        }

        if (job.status !== "completed" || !job.paths) {
          writeJson(response, 409, {
            error: "Job result is not available yet",
            status: job.status,
          });
          return;
        }

        writeJson(response, 200, job.paths);
        return;
      }

      const jobMatch = url.pathname.match(/^\/jobs\/([^/]+)$/);
      if (request.method === "GET" && jobMatch) {
        const job = await dependencies.getJob(jobMatch[1]);

        if (!job) {
          writeJson(response, 404, { error: "Job not found" });
          return;
        }

        writeJson(response, 200, job);
        return;
      }

      writeJson(response, 404, { error: "Not found" });
    } catch (error) {
      writeJson(response, 500, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

# OpenEvolution

OpenEvolution reconstructs how an open-source product evolves over time from its repository history.

## Quick start

```bash
npm install
cp .env.example .env
npm run build
npm start -- analyze https://github.com/vercel/next.js --output ./outputs/next-js --since 2023-01-01
```

Required environment variables:

- `OPENAI_API_KEY`: used for bucket interpretation, stage segmentation, milestone detection, and synthesis

Optional environment variables:

- `GITHUB_TOKEN`: raises GitHub API limits
- `STAR_HISTORY_ENDPOINT`: third-party star-history endpoint that accepts `?repo=<repo-url>`
- `OPENEVOLUTION_MODEL`: preferred default model when you want to pin the provider choice
- `OPENEVOLUTION_SERVICE_PORT`: port used by service mode, defaults to `3030`

If `--model` is omitted, OpenEvolution resolves a compatible model from the provider and falls back to `OPENEVOLUTION_MODEL` when it is set.

## Output

Each run writes:

- `report/index.html`: shareable static report
- `artifacts/collected.json`: normalized repository evidence
- `artifacts/time-buckets.json`: deterministic weekly buckets
- `artifacts/bucket-interpretations.json`: structured bucket-level AI output
- `artifacts/analysis.json`: final analysis artifact
- `artifacts/run-manifest.json`: stage-by-stage run state, errors, and artifact paths

## Service mode

```bash
npm run build
npm run service
```

The service is intentionally thin. It reuses the same pipeline as the CLI and exposes:

- `POST /jobs`: queue a repository analysis job
- `GET /jobs/:id`: inspect current job state
- `GET /jobs/:id/result`: return final artifact paths after completion

Example request:

```bash
curl -X POST http://127.0.0.1:3030/jobs \
  -H 'content-type: application/json' \
  -d '{
    "repoUrl": "https://github.com/vercel/next.js",
    "outputDir": "./outputs/next-js",
    "since": "2023-01-01"
  }'
```

## Skill integration contract

This repo is now shaped so another agent can call it as a background analysis primitive.

Expected inputs:

- `repoUrl`
- `outputDir`
- `model` (optional)
- `since` / `until` (optional)

Expected outputs:

- job `id` and `status`
- final `analysisJson`, `reportHtml`, and `runManifest` paths
- explicit `failed` status plus `error` when a run does not complete

## Development

```bash
npm test
npm run check
npm run build
```

## Notes

- `--since` and `--until` filter repository evidence before analysis.
- The CLI and service both favor simple serial execution over concurrency.
- If `STAR_HISTORY_ENDPOINT` is unavailable, the run continues with empty star history.

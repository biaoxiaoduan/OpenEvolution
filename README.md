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

## Output

Each run writes:

- `report/index.html`: shareable static report
- `artifacts/collected.json`: normalized repository evidence
- `artifacts/time-buckets.json`: deterministic weekly buckets
- `artifacts/bucket-interpretations.json`: structured bucket-level AI output
- `artifacts/analysis.json`: final analysis artifact

## Development

```bash
npm test
npm run check
npm run build
```

## Notes

- `--since` and `--until` filter repository evidence before analysis.
- If `STAR_HISTORY_ENDPOINT` is unavailable, the run continues with empty star history.

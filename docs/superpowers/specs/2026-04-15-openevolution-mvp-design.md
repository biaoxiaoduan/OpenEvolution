# OpenEvolution MVP Design

## Summary

OpenEvolution is an insight engine for understanding how successful open-source products evolve over time. The MVP is a CLI tool for content creators and indie builders. Given a GitHub repository URL, it collects repository history and star-growth data, runs a multi-step AI analysis pipeline, and produces a shareable static HTML report that explains the product's evolution, stage changes, milestones, and reusable growth insights.

The MVP is intentionally narrow. It is not a general commit analyzer, a hosted SaaS, a comparative research platform, or a collaborative editing product. Its job is to turn one repository into one strong evolution narrative with traceable evidence.

## Product Goal

The first release should help a content-oriented user answer questions such as:

- What did the first usable version look like?
- When did the project become product-like rather than exploratory?
- Which product, UX, documentation, or distribution changes preceded breakout growth?
- What repeatable patterns can be extracted from the repository's evolution?

The MVP succeeds if it can generate a report that is strong enough to become the basis for a blog post, social thread, newsletter issue, or case-study writeup with only light human editing.

## User And Primary Use Case

### Primary user

Content creators, indie hackers, and AI builders who want to study successful open-source projects and turn those analyses into public content.

### Primary workflow

1. The user runs a CLI command with a repository URL.
2. The tool fetches historical repository data and star-growth data.
3. The tool compresses the history into analysis-ready units.
4. The tool runs a staged AI analysis workflow.
5. The tool writes a structured analysis artifact and renders a static HTML report.
6. The user opens the generated report locally and uses it as a publishable analysis draft.

## Non-Goals

The MVP explicitly does not include:

- Hosted SaaS infrastructure
- Multi-repository comparison
- A browser-native analysis UI
- Human-in-the-loop editing workflows
- Academic-grade causal claims
- Exhaustive issue, discussion, and community analysis

These can become later layers, but they should not shape the initial implementation.

## Product Contract

The CLI contract for the MVP is:

```bash
openevolution analyze <repo-url> \
  --output ./outputs/<repo-slug> \
  --since 2023-01-01 \
  --model <model-name>
```

The required behavior is:

- Accept a GitHub repository URL as input
- Generate a complete analysis run for a single repository
- Write a shareable static HTML report
- Persist structured intermediate and final artifacts for debugging and iteration

Expected output directory:

- `report/index.html`: shareable static report
- `artifacts/analysis.json`: final structured analysis result
- `artifacts/`: normalized source data, bucket summaries, and prompt/response records

## Core Design Principles

### 1. Build an insight engine, not a summarizer

The system must interpret product intent, not merely restate commit messages.

### 2. Use layered reasoning

The pipeline must not dump the full repository history into one prompt. It should reason in stages from local evidence to global synthesis.

### 3. Preserve evidence traceability

Every high-level conclusion should be traceable back to bucket-level evidence and source events.

### 4. Separate analysis from presentation

The analysis pipeline should produce a stable domain artifact. The HTML report is a view over that artifact, not the source of truth.

### 5. Fail conservatively

When evidence is weak, the system should lower confidence or decline to assert a conclusion rather than invent one.

## System Architecture

The MVP should be implemented as five modules coordinated by the CLI.

### 1. Collector

Responsibilities:

- Fetch commit history
- Fetch PR titles and merge timing
- Fetch releases
- Fetch README snapshots at meaningful points in time
- Fetch star-growth timeline

Constraints:

- This module only gathers and normalizes data
- It must not perform interpretation or stage inference

### 2. Preprocessor

Responsibilities:

- Convert raw repository history into analysis-ready time buckets
- Summarize each bucket into a compact representation
- Record feature, UX, documentation, release, collaboration, and star-growth signals

Constraints:

- Bucketing should reduce token volume without destroying narrative continuity
- The bucket representation should be model-friendly and deterministic

### 3. Analysis Engine

Responsibilities:

- Interpret the product meaning of each bucket
- Segment the repository into evolution stages
- Detect key milestones
- Produce a breakout explanation
- Extract reusable methodologies

Constraints:

- Analysis should be multi-step, not monolithic
- Each step should emit structured output

### 4. Artifact Store

Responsibilities:

- Persist normalized data
- Persist bucket-level summaries
- Persist LLM inputs and outputs
- Persist final structured analysis

Constraints:

- Runs must be debuggable and partially reproducible
- Intermediate artifacts should support prompt iteration and later evaluation

### 5. Renderer

Responsibilities:

- Read the final structured analysis artifact
- Render a static HTML report
- Present both narrative conclusions and supporting evidence

Constraints:

- Rendering should not depend on collector or LLM internals
- Future outputs such as Markdown or a web UI should be able to reuse the same analysis artifact

## Data Inputs

The MVP data layer should include:

- GitHub commit history
- Pull request titles and dates
- Releases
- README evolution snapshots
- Star-growth timeline from GitHub-compatible or third-party data

The first release should avoid deeper sources such as issues, discussions, or external community data unless they are later added behind a separate scope decision.

## Analysis Workflow

The analysis workflow should be implemented as four explicit stages.

### Step A: Bucket Interpretation

Input:

- One time bucket with normalized signals

Output:

- What changed in that period
- What kind of work dominated that period
- What the changes suggest about product intent

Purpose:

- Translate low-level repository activity into product-language meaning

### Step B: Cross-Bucket Stage Segmentation

Input:

- Ordered bucket interpretations across the repository timeline

Output:

- Stage boundaries
- Stage labels
- Stage summaries
- Why each boundary exists

Purpose:

- Identify transitions such as exploration, formation, growth, and breakout

### Step C: Milestone Detection

Input:

- Bucket interpretations plus stage segmentation

Output:

- First usable version
- First good-UX version
- First demo-ready or shareable version
- Direction shifts
- Pre-breakout turning points

Purpose:

- Surface the moments that matter most for narrative and learning value

### Step D: Global Synthesis

Input:

- Project metadata
- Stage definitions
- Milestones
- Breakout signals

Output:

- Overview narrative
- Growth timeline copy
- Breakout analysis
- Transferable methodologies

Purpose:

- Produce the final insight layer without reprocessing raw repository history

## Analysis Schema

The final structured artifact should be `analysis.json` with six top-level domains.

### 1. `project`

Fields should include:

- Repository identity and description
- Current scale metrics such as stars and contributors
- Analysis time range
- First commit date
- Run timestamp

### 2. `timeline_buckets`

Each bucket should include:

- Time range
- Commit, PR, and release summaries
- README or onboarding changes
- Star-growth change summary
- Intent interpretation

This layer should remain visible in the final artifact because it serves as the evidence backbone for higher-level conclusions.

### 3. `stages`

Each stage should include:

- Stable identifier
- Name
- Start and end timestamps
- Summary
- Why the stage is defined that way
- Dominant work types
- Product state
- Supporting bucket references

### 4. `milestones`

Each milestone should include:

- Type
- Timestamp
- Title
- Summary
- Why it matters
- Confidence level
- Supporting bucket references

Confidence should be coarse and honest, such as `high`, `medium`, or `low`.

### 5. `breakout_analysis`

This section should explain:

- The lead-up to breakout
- Which product, UX, documentation, or distribution changes mattered most
- How star growth and product evolution relate in the narrative

### 6. `insights`

Each insight should include:

- The extracted pattern
- Evidence
- A transferable takeaway

These insights must be grounded in stage and milestone evidence, not free-form commentary.

## Reliability And Cost Control

The MVP should assume that LLM analysis is the differentiator, but it must still be bounded.

### Cost controls

- Never send the full raw history into a single prompt
- Compress history into buckets before analysis
- Cache intermediate artifacts on disk
- Restrict each analysis step to the minimum required context
- Allow cheaper models for lower-level summarization and stronger models for final synthesis

### Reliability controls

- Require structured outputs at each analysis step
- Enforce evidence references for high-level claims
- Add rule-based sanity checks for stage and milestone plausibility
- Support graceful degradation when star timeline data is missing or inconsistent

### Failure behavior

Examples of acceptable conservative failure:

- No confident breakout detected
- No good-UX milestone detected
- Low-confidence direction-shift claim

The system should prefer explicit uncertainty over fabricated insight.

## Static Report Structure

The generated HTML report should have six primary sections.

### 1. Hero / Overview

- What the project does
- Current scale snapshot
- One sentence explaining the overall growth story

### 2. Growth Timeline

- Chronological key events
- Time, title, explanation, and supporting evidence for each event

This is the core visual section of the report.

### 3. Evolution Stages

- Stage-by-stage explanation of project maturity
- Product state and dominant work types per stage

### 4. Breakout Analysis

- The most important actions preceding breakout
- Breakdown across product, UX, documentation, and distribution signals

### 5. Key Insights

- Three to five reusable takeaways
- Each insight grounded in stage and milestone evidence

### 6. Evidence Drawer

- Expandable support section
- Bucket summaries
- Relevant PR, release, and README references

This keeps the report narrative-first while still defensible.

## Error Handling

The CLI should handle incomplete or degraded runs explicitly.

Examples:

- If GitHub data fetch fails, return a clear collection error and stop the run
- If star timeline data fails, continue with reduced breakout confidence
- If one analysis step fails, preserve all completed artifacts for inspection
- If rendering fails, do not delete the completed analysis artifact

The user should always be able to inspect what was collected and which stage of the pipeline failed.

## Testing Strategy

The MVP test strategy should focus on pipeline integrity and analysis artifact quality rather than broad surface-area coverage.

### 1. Collector tests

- Validate GitHub normalization
- Validate star timeline fetch behavior
- Validate degraded behavior when optional data is unavailable

### 2. Schema tests

- Validate `analysis.json` shape
- Validate required fields
- Validate bucket, stage, and milestone references

### 3. Pipeline tests

- Run the end-to-end pipeline on a small fixture repository
- Confirm both `analysis.json` and `report/index.html` are generated

### 4. Renderer tests

- Verify required report sections exist
- Verify timeline, stage, and insights sections render from artifact data

### 5. Evaluation fixtures

- Maintain two or three known repositories for manual quality review
- Check whether stage boundaries and milestones are directionally credible

This manual evaluation layer matters because the product's value depends on narrative quality, not just execution success.

## Suggested Initial Scope Order

Implementation should proceed in this order:

1. CLI shell and run directory structure
2. Collector for repository metadata, commits, PR titles, releases, and README snapshots
3. Star timeline integration
4. Time-bucket preprocessing
5. Bucket interpretation
6. Stage segmentation
7. Milestone detection
8. Global synthesis
9. Static HTML renderer
10. Evaluation fixtures and quality review

This order preserves a working vertical slice while keeping the analysis core ahead of presentation polish.

## Open Questions Deferred Beyond MVP

The following are intentionally postponed:

- Multi-repository comparison
- Hosted sharing and permanent URLs
- Manual editing interfaces
- Comparative growth benchmarking
- Community and issue-based growth signals
- Database-backed project archive

They are future product directions, not first-release requirements.

## Final Definition

OpenEvolution MVP is a CLI-first insight engine that takes a GitHub repository URL, collects repository and star-growth history, transforms that history into analysis-ready buckets, runs a layered LLM workflow to infer stages and milestones, and renders a shareable static HTML report plus structured analysis artifacts.

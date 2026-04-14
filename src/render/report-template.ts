import type { AnalysisResult } from "../types/domain.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderList(items: string[]): string {
  if (items.length === 0) {
    return "<p class=\"muted\">No evidence recorded.</p>";
  }

  return `<ul>${items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("")}</ul>`;
}

export function reportTemplate(result: AnalysisResult): string {
  const timelineMarkup =
    result.milestones.length > 0
      ? result.milestones
          .map(
            (milestone) => `<article class="card timeline-item">
        <p class="eyebrow">${escapeHtml(milestone.timestamp)}</p>
        <h3>${escapeHtml(milestone.title)}</h3>
        <p>${escapeHtml(milestone.summary)}</p>
        <p class="muted">${escapeHtml(milestone.whyItMatters)}</p>
      </article>`,
          )
          .join("")
      : `<article class="card timeline-item"><h3>Signal not yet strong enough</h3><p>${escapeHtml(
          result.breakoutAnalysis,
        )}</p></article>`;

  const stagesMarkup = result.stages
    .map(
      (stage) => `<article class="card stage">
      <p class="eyebrow">${escapeHtml(stage.name)}</p>
      <h3>${escapeHtml(stage.summary)}</h3>
      <p>${escapeHtml(stage.productState)}</p>
      <p class="muted">${escapeHtml(stage.whyThisStage)}</p>
    </article>`,
    )
    .join("");

  const insightsMarkup = result.insights
    .map(
      (insight) => `<article class="card insight">
      <h3>${escapeHtml(insight.pattern)}</h3>
      <p>${escapeHtml(insight.transferableTakeaway)}</p>
      <p class="muted">${escapeHtml(insight.evidence)}</p>
    </article>`,
    )
    .join("");

  const evidenceMarkup = result.timelineBuckets
    .map(
      (bucket) => `<details class="card evidence">
      <summary>${escapeHtml(bucket.startAt)} to ${escapeHtml(bucket.endAt)}</summary>
      <p>${escapeHtml(bucket.interpretation?.summary ?? "No interpretation recorded.")}</p>
      <h4>Commits</h4>
      ${renderList(bucket.commitTitles)}
      <h4>Pull Requests</h4>
      ${renderList(bucket.pullRequestTitles)}
      <h4>Releases</h4>
      ${renderList(bucket.releases)}
    </details>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OpenEvolution Report - ${escapeHtml(
      result.project.repository.slug,
    )}</title>
    <style>
      :root {
        --bg: #f3efe6;
        --paper: #fffaf0;
        --ink: #1b2a1f;
        --muted: #5e6c61;
        --accent: #c35c2f;
        --line: #d9d0c2;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(195, 92, 47, 0.12), transparent 24%),
          linear-gradient(180deg, var(--bg), #f7f3eb);
      }
      main {
        width: min(1100px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 40px 0 72px;
      }
      section { margin-top: 32px; }
      h1, h2, h3, h4, p { margin: 0; }
      h1 { font-size: clamp(2.8rem, 6vw, 4.6rem); line-height: 0.95; }
      h2 { font-size: 1.7rem; margin-bottom: 16px; }
      h3 { font-size: 1.15rem; margin-bottom: 8px; }
      p { line-height: 1.6; }
      a { color: inherit; }
      .hero {
        background: linear-gradient(140deg, rgba(255,255,255,0.8), rgba(255,250,240,0.94));
        border: 1px solid var(--line);
        border-radius: 28px;
        padding: 32px;
        box-shadow: 0 18px 60px rgba(27, 42, 31, 0.08);
      }
      .hero-meta {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin-top: 24px;
      }
      .card {
        background: var(--paper);
        border: 1px solid var(--line);
        border-radius: 22px;
        padding: 18px;
        box-shadow: 0 10px 30px rgba(27, 42, 31, 0.05);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 16px;
      }
      .eyebrow {
        color: var(--accent);
        font-size: 0.78rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        margin-bottom: 10px;
      }
      .muted {
        color: var(--muted);
        margin-top: 8px;
      }
      ul {
        margin: 8px 0 0;
        padding-left: 18px;
      }
      details summary {
        cursor: pointer;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="eyebrow">OpenEvolution Report</p>
        <h1>${escapeHtml(result.project.repository.name)}</h1>
        <p class="muted">
          ${escapeHtml(result.breakoutAnalysis)}
        </p>
        <div class="hero-meta">
          <div class="card"><strong>${result.project.stats.stars}</strong><p>Stars</p></div>
          <div class="card"><strong>${result.project.stats.contributors}</strong><p>Contributors</p></div>
          <div class="card"><strong>${escapeHtml(result.project.firstCommitAt)}</strong><p>First Commit</p></div>
          <div class="card"><strong><a href="${escapeHtml(
            result.project.repository.url,
          )}">${escapeHtml(result.project.repository.slug)}</a></strong><p>Repository</p></div>
        </div>
      </section>

      <section>
        <h2>Growth Timeline</h2>
        <div class="grid">${timelineMarkup}</div>
      </section>

      <section>
        <h2>Evolution Stages</h2>
        <div class="grid">${stagesMarkup || "<p>No stages detected.</p>"}</div>
      </section>

      <section>
        <h2>Breakout Analysis</h2>
        <article class="card"><p>${escapeHtml(result.breakoutAnalysis)}</p></article>
      </section>

      <section>
        <h2>Key Insights</h2>
        <div class="grid">${insightsMarkup || "<p>No insights extracted.</p>"}</div>
      </section>

      <section>
        <h2>Evidence Drawer</h2>
        <div class="grid">${evidenceMarkup || "<p>No evidence buckets captured.</p>"}</div>
      </section>
    </main>
  </body>
</html>`;
}

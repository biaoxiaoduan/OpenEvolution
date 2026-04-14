import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AnalysisResult } from "../types/domain.js";
import { reportTemplate } from "./report-template.js";

export function renderReportHtml(result: AnalysisResult): string {
  return reportTemplate(result);
}

export async function writeReport(
  result: AnalysisResult,
  reportDir: string,
): Promise<string> {
  await mkdir(reportDir, { recursive: true });
  const targetPath = join(reportDir, "index.html");
  await writeFile(targetPath, renderReportHtml(result), "utf8");
  return targetPath;
}

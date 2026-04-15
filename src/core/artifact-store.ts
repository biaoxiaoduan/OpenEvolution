import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export async function writeJsonArtifact<T>(
  baseDir: string,
  relativePath: string,
  value: T,
): Promise<string> {
  const targetPath = join(baseDir, relativePath);
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return targetPath;
}

export async function readJsonFile<T>(targetPath: string): Promise<T> {
  const payload = await readFile(targetPath, "utf8");
  return JSON.parse(payload) as T;
}

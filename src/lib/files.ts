import { copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { glob } from "glob";

export interface CopyResult {
  copied: string[];
  skipped: string[];
  failed: Array<{ file: string; error: string }>;
}

export async function copyEnvFiles(
  sourceDir: string,
  targetDir: string,
  files: string[],
  patterns: string[]
): Promise<CopyResult> {
  const result: CopyResult = {
    copied: [],
    skipped: [],
    failed: [],
  };

  // Collect all files to copy
  const filesToCopy = new Set<string>();

  // Add explicit files
  for (const file of files) {
    filesToCopy.add(file);
  }

  // Add files matching patterns
  for (const pattern of patterns) {
    const matches = await glob(pattern, {
      cwd: sourceDir,
      dot: true,
      nodir: true,
    });
    for (const match of matches) {
      filesToCopy.add(match);
    }
  }

  // Copy each file
  for (const file of filesToCopy) {
    const sourcePath = join(sourceDir, file);
    const targetPath = join(targetDir, file);

    if (!existsSync(sourcePath)) {
      result.skipped.push(file);
      continue;
    }

    try {
      // Ensure target directory exists
      const targetDirPath = dirname(targetPath);
      if (!existsSync(targetDirPath)) {
        await mkdir(targetDirPath, { recursive: true });
      }

      await copyFile(sourcePath, targetPath);
      result.copied.push(file);
    } catch (error) {
      result.failed.push({
        file,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

export function getRelativePath(from: string, to: string): string {
  return relative(from, to);
}

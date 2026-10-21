import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { WorktreeConfig } from "../types.js";

const DEFAULT_CONFIG: WorktreeConfig = {
  copyFiles: [".env", ".env.local", ".env.development", ".env.development.local"],
  copyPatterns: [".claude/**"],
  setupCommands: [],
  worktreeDir: ".worktrees/{name}",
  branchPrefix: "",
  postSetupMessage: null,
  docsEnabled: true,
  docsDir: ".worktree-docs",
  testCommands: [],
  requireTestsOnFinish: false,
  testTimeout: 300000, // 5 minutes
};

const CONFIG_FILENAMES = [".worktreerc.json", ".worktreerc"];

export async function loadConfig(projectDir: string): Promise<WorktreeConfig> {
  for (const filename of CONFIG_FILENAMES) {
    const configPath = join(projectDir, filename);
    if (existsSync(configPath)) {
      const content = await readFile(configPath, "utf-8");
      let userConfig: Partial<WorktreeConfig>;
      try {
        userConfig = JSON.parse(content) as Partial<WorktreeConfig>;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid JSON in ${configPath}: ${reason}`);
      }
      return mergeConfig(userConfig);
    }
  }
  return getDefaultConfig();
}

export function mergeConfig(userConfig: Partial<WorktreeConfig>): WorktreeConfig {
  return {
    copyFiles: userConfig.copyFiles ?? DEFAULT_CONFIG.copyFiles,
    copyPatterns: userConfig.copyPatterns ?? DEFAULT_CONFIG.copyPatterns,
    setupCommands: userConfig.setupCommands ?? DEFAULT_CONFIG.setupCommands,
    worktreeDir: userConfig.worktreeDir ?? DEFAULT_CONFIG.worktreeDir,
    branchPrefix: userConfig.branchPrefix ?? DEFAULT_CONFIG.branchPrefix,
    postSetupMessage: userConfig.postSetupMessage ?? DEFAULT_CONFIG.postSetupMessage,
    docsEnabled: userConfig.docsEnabled ?? DEFAULT_CONFIG.docsEnabled,
    docsDir: userConfig.docsDir ?? DEFAULT_CONFIG.docsDir,
    testCommands: userConfig.testCommands ?? DEFAULT_CONFIG.testCommands,
    requireTestsOnFinish: userConfig.requireTestsOnFinish ?? DEFAULT_CONFIG.requireTestsOnFinish,
    testTimeout: userConfig.testTimeout ?? DEFAULT_CONFIG.testTimeout,
  };
}

export function getDefaultConfig(): WorktreeConfig {
  return {
    ...DEFAULT_CONFIG,
    copyFiles: [...DEFAULT_CONFIG.copyFiles],
    copyPatterns: [...DEFAULT_CONFIG.copyPatterns],
    setupCommands: [...DEFAULT_CONFIG.setupCommands],
    testCommands: [...DEFAULT_CONFIG.testCommands],
  };
}

export function resolveWorktreeDir(
  pattern: string,
  name: string,
  repoName: string
): string {
  return pattern.replaceAll("{name}", name).replaceAll("{repo}", repoName);
}

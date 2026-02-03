import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { WorktreeConfig } from "../types.js";

const DEFAULT_CONFIG: WorktreeConfig = {
  copyFiles: [".env", ".env.local", ".env.development", ".env.development.local"],
  copyPatterns: [],
  setupCommands: [],
  worktreeDir: ".worktrees/{name}",
  branchPrefix: "",
  postSetupMessage: null,
  docsEnabled: true,
  docsDir: ".worktree-docs",
};

const CONFIG_FILENAMES = [".worktreerc.json", ".worktreerc"];

export async function loadConfig(projectDir: string): Promise<WorktreeConfig> {
  for (const filename of CONFIG_FILENAMES) {
    const configPath = join(projectDir, filename);
    if (existsSync(configPath)) {
      const content = await readFile(configPath, "utf-8");
      const userConfig = JSON.parse(content) as Partial<WorktreeConfig>;
      return mergeConfig(userConfig);
    }
  }
  return DEFAULT_CONFIG;
}

function mergeConfig(userConfig: Partial<WorktreeConfig>): WorktreeConfig {
  return {
    copyFiles: userConfig.copyFiles ?? DEFAULT_CONFIG.copyFiles,
    copyPatterns: userConfig.copyPatterns ?? DEFAULT_CONFIG.copyPatterns,
    setupCommands: userConfig.setupCommands ?? DEFAULT_CONFIG.setupCommands,
    worktreeDir: userConfig.worktreeDir ?? DEFAULT_CONFIG.worktreeDir,
    branchPrefix: userConfig.branchPrefix ?? DEFAULT_CONFIG.branchPrefix,
    postSetupMessage: userConfig.postSetupMessage ?? DEFAULT_CONFIG.postSetupMessage,
    docsEnabled: userConfig.docsEnabled ?? DEFAULT_CONFIG.docsEnabled,
    docsDir: userConfig.docsDir ?? DEFAULT_CONFIG.docsDir,
  };
}

export function getDefaultConfig(): WorktreeConfig {
  return { ...DEFAULT_CONFIG };
}

export function resolveWorktreeDir(
  pattern: string,
  name: string,
  repoName: string
): string {
  return pattern.replace("{name}", name).replace("{repo}", repoName);
}

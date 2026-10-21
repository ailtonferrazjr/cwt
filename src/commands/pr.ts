import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execSync, spawnSync } from "node:child_process";
import chalk from "chalk";
import { loadConfig, resolveWorktreeDir } from "../lib/config.js";
import { buildPrBody, parseDocForPr, titleFromName } from "../lib/pr.js";
import {
  detectWorktreeContext,
  getRepoName,
  getRepoRoot,
  getCurrentBranch,
} from "../lib/git.js";
import { getActiveDocPath, getWorktreeDocPath } from "../lib/docs.js";
import { join } from "node:path";

export interface PrOptions {
  self?: boolean;
  draft?: boolean;
  web?: boolean;
}

function hasGhCli(): boolean {
  try {
    execSync("gh --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function hasRemote(): boolean {
  try {
    const result = execSync("git remote", { encoding: "utf-8" });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

function pushBranch(branch: string): boolean {
  const result = spawnSync("git", ["push", "-u", "origin", branch], {
    stdio: "inherit",
  });
  return result.status === 0;
}

export async function prCommand(
  name: string | undefined,
  options: PrOptions
): Promise<void> {
  // Check for gh CLI
  if (!hasGhCli()) {
    console.error(chalk.red("GitHub CLI (gh) is not installed."));
    console.log(chalk.dim("Install it from: https://cli.github.com/"));
    process.exit(1);
  }

  let worktreeName = name;
  let repoRoot: string;

  // Handle --self flag
  if (options.self) {
    const context = detectWorktreeContext();

    if (!context.isWorktree) {
      console.error(chalk.red("Not inside a .worktrees/ directory"));
      console.log(chalk.dim("Run from within a worktree, or specify the name."));
      process.exit(1);
    }

    worktreeName = context.worktreeName!;
    repoRoot = context.mainRepoPath!;
  } else {
    repoRoot = getRepoRoot();
  }

  if (!worktreeName) {
    // Try to infer from current branch
    const branch = getCurrentBranch();
    if (branch && branch !== "main" && branch !== "master") {
      worktreeName = branch;
    } else {
      console.error(chalk.red("Worktree name is required"));
      console.log(chalk.dim("Usage: cwt pr <name> or cwt pr --self"));
      process.exit(1);
    }
  }

  const config = await loadConfig(repoRoot);
  const repoName = getRepoName(repoRoot);

  // Determine worktree path for checking WORKTREE.md
  const worktreePath = options.self
    ? process.cwd()
    : join(repoRoot, resolveWorktreeDir(config.worktreeDir, worktreeName, repoName));

  // Check for doc in WORKTREE.md first (new location), then fall back to legacy active dir
  const worktreeDocPath = getWorktreeDocPath(worktreePath);
  const legacyDocPath = getActiveDocPath(repoRoot, config.docsDir, worktreeName);
  const docPath = existsSync(worktreeDocPath) ? worktreeDocPath : legacyDocPath;

  let prTitle = titleFromName(worktreeName);
  let prBody = "";

  if (existsSync(docPath)) {
    const content = await readFile(docPath, "utf-8");
    const parsed = parseDocForPr(content, worktreeName);
    prTitle = parsed.title;
    prBody = buildPrBody(parsed);
    const docName = docPath === worktreeDocPath ? "WORKTREE.md" : `${worktreeName}.md`;
    console.log(chalk.green(`✓ Found documentation: ${docName}`));
  } else {
    console.log(chalk.yellow(`⚠ No documentation found for: ${worktreeName}`));
    console.log(chalk.dim("Creating PR with minimal description."));
  }

  // Check for remote
  if (!hasRemote()) {
    console.error(chalk.red("No git remote configured."));
    process.exit(1);
  }

  // Get current branch for pushing
  const currentBranch = getCurrentBranch();

  // Push branch to remote if needed
  console.log(chalk.dim(`Pushing ${currentBranch} to remote...`));
  if (!pushBranch(currentBranch)) {
    console.error(chalk.red("Failed to push branch to remote."));
    process.exit(1);
  }
  console.log(chalk.green(`✓ Pushed branch: ${currentBranch}`));

  // Build gh pr create command
  const ghArgs = ["pr", "create", "--title", prTitle];

  if (prBody) {
    ghArgs.push("--body", prBody);
  } else {
    ghArgs.push("--body", "");
  }

  if (options.draft) {
    ghArgs.push("--draft");
  }

  if (options.web) {
    ghArgs.push("--web");
  }

  console.log(chalk.dim("\nCreating pull request..."));

  const result = spawnSync("gh", ghArgs, {
    stdio: "inherit",
    cwd: options.self ? undefined : repoRoot,
  });

  if (result.status !== 0) {
    console.error(chalk.red("\n✗ Failed to create pull request"));
    process.exit(1);
  }

  console.log(chalk.green("\n✓ Pull request created!"));
}

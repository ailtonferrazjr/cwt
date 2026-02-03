import { resolve } from "node:path";
import chalk from "chalk";
import type { FinishOptions } from "../types.js";
import {
  deleteBranch,
  detectWorktreeContext,
  getRepoRoot,
  listWorktrees,
  mergeBranch,
  mergeBranchWithMessage,
  pruneWorktrees,
  pushToRemote,
  removeWorktree,
} from "../lib/git.js";
import { loadConfig } from "../lib/config.js";
import { archiveDoc, activeDocExists } from "../lib/docs.js";

export async function finishCommand(
  name: string | undefined,
  options: FinishOptions
): Promise<void> {
  let targetName = name;
  let workingDir = process.cwd();

  // Handle --self flag: detect worktree from current directory
  if (options.self) {
    const context = detectWorktreeContext();

    if (!context.isWorktree) {
      console.error(chalk.red("Not inside a .worktrees/ directory"));
      console.log(chalk.dim("Run this command from within a worktree, or specify the name explicitly."));
      process.exit(1);
    }

    targetName = context.worktreeName!;
    workingDir = context.mainRepoPath!;

    console.log(chalk.blue(`Detected worktree: ${targetName}`));
    console.log(chalk.dim(`Switching to main repo: ${workingDir}\n`));

    // Change to main repo directory
    process.chdir(workingDir);
  }

  if (!targetName) {
    console.error(chalk.red("Worktree name is required"));
    console.log(chalk.dim("Usage: cwt finish <name> or cwt finish --self"));
    process.exit(1);
  }

  const repoRoot = getRepoRoot();
  const worktrees = listWorktrees();

  // Find worktree by name (can match path or branch)
  const worktree = worktrees.find((wt) => {
    const pathName = wt.path.split("/").pop();
    return (
      pathName === targetName ||
      wt.branch === targetName ||
      wt.path === targetName ||
      wt.path === resolve(targetName)
    );
  });

  if (!worktree) {
    console.error(chalk.red(`Worktree not found: ${targetName}`));
    console.log(chalk.dim("\nAvailable worktrees:"));
    for (const wt of worktrees) {
      console.log(chalk.dim(`  - ${wt.path} (${wt.branch})`));
    }
    process.exit(1);
  }

  // Don't allow finishing the main worktree
  if (worktree.path === repoRoot) {
    console.error(chalk.red("Cannot finish the main worktree"));
    process.exit(1);
  }

  const branchToMerge = worktree.branch;

  if (!branchToMerge || branchToMerge === "(detached)") {
    console.error(chalk.red("Cannot finish a detached HEAD worktree"));
    process.exit(1);
  }

  console.log(chalk.blue(`\nFinishing worktree: ${worktree.path}`));
  console.log(chalk.dim(`Branch: ${branchToMerge}\n`));

  // Load config for docs
  const config = await loadConfig(repoRoot);

  // 0. Archive documentation (before merge so we can capture branch commits)
  if (config.docsEnabled && activeDocExists(repoRoot, config.docsDir, targetName)) {
    try {
      const result = await archiveDoc(repoRoot, config.docsDir, targetName, branchToMerge);
      if (result.archived && result.path) {
        const relativePath = result.path.replace(repoRoot + "/", "");
        console.log(chalk.green(`✓ Archived doc: ${relativePath}`));
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠ Could not archive documentation`));
    }
  }

  // 1. Merge the branch
  try {
    console.log(chalk.dim(`Merging ${branchToMerge}...`));
    if (options.message) {
      mergeBranchWithMessage(branchToMerge, options.message);
    } else {
      mergeBranch(branchToMerge);
    }
    console.log(chalk.green(`✓ Merged branch: ${branchToMerge}`));
  } catch (error) {
    console.error(chalk.red(`✗ Failed to merge branch: ${branchToMerge}`));
    console.log(chalk.dim("  Resolve conflicts manually, then run:"));
    console.log(chalk.dim(`    cwt remove ${targetName} -D`));
    process.exit(1);
  }

  // 2. Remove worktree
  try {
    removeWorktree(worktree.path, false);
    console.log(chalk.green(`✓ Removed worktree: ${worktree.path}`));
  } catch (error) {
    console.error(chalk.red(`✗ Failed to remove worktree`));
    console.log(chalk.dim("  The merge succeeded. Clean up manually with:"));
    console.log(chalk.dim(`    git worktree remove "${worktree.path}"`));
    process.exit(1);
  }

  // 3. Prune worktrees
  pruneWorktrees();

  // 4. Delete the branch (default: true)
  const shouldDeleteBranch = options.deleteBranch !== false;
  if (shouldDeleteBranch) {
    try {
      deleteBranch(branchToMerge, false);
      console.log(chalk.green(`✓ Deleted branch: ${branchToMerge}`));
    } catch (error) {
      console.error(
        chalk.yellow(`⚠ Could not delete branch: ${branchToMerge}`)
      );
    }
  }

  // 5. Push if requested
  if (options.push) {
    try {
      console.log(chalk.dim("Pushing to remote..."));
      pushToRemote();
      console.log(chalk.green(`✓ Pushed to remote`));
    } catch (error) {
      console.error(chalk.yellow(`⚠ Could not push to remote`));
    }
  }

  console.log(chalk.green("\n✓ Finish complete!"));
}

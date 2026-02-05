import { resolve } from "node:path";
import chalk from "chalk";
import type { FinishOptions } from "../types.js";
import {
  commitDocChanges,
  deleteBranch,
  detectWorktreeContext,
  getRepoRoot,
  hasChangesInPath,
  hasUncommittedChanges,
  listWorktrees,
  mergeBranch,
  mergeBranchWithMessage,
  pruneWorktrees,
  pushToRemote,
  removeWorktree,
  removeWorktreeDocFromGit,
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

  if (worktree.isLocked) {
    console.error(chalk.red("Cannot finish a locked worktree"));
    console.log(chalk.dim("  Unlock it first with: git worktree unlock \"" + worktree.path + "\""));
    process.exit(1);
  }

  console.log(chalk.blue(`\nFinishing worktree: ${worktree.path}`));
  console.log(chalk.dim(`Branch: ${branchToMerge}\n`));

  // Check for uncommitted changes (excluding WORKTREE.md)
  if (hasUncommittedChanges(worktree.path)) {
    console.error(chalk.red("⚠ Worktree has uncommitted changes"));
    console.log(chalk.dim("  Commit or stash your changes before finishing."));
    console.log(chalk.dim(`  To discard changes and finish anyway, use:`));
    console.log(chalk.dim(`    git -C "${worktree.path}" checkout . && cwt finish ${targetName}`));
    process.exit(1);
  }

  // Load config for docs
  const config = await loadConfig(repoRoot);

  // 0. Archive documentation (before merge so we can capture branch commits)
  // Pass worktree path so it can find the doc in WORKTREE.md (or fall back to legacy location)
  if (config.docsEnabled && activeDocExists(repoRoot, config.docsDir, targetName, worktree.path)) {
    try {
      const result = await archiveDoc(repoRoot, config.docsDir, targetName, branchToMerge, worktree.path);
      if (result.archived && result.path) {
        const relativePath = result.path.replace(repoRoot + "/", "");
        console.log(chalk.green(`✓ Archived doc: ${relativePath}`));
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠ Could not archive documentation`));
    }
  }

  // 1. Remove WORKTREE.md from git tracking to prevent merge conflicts
  // (The doc content was already archived in step 0)
  if (removeWorktreeDocFromGit(worktree.path)) {
    console.log(chalk.green(`✓ Removed WORKTREE.md from git tracking`));
  }

  // 2. Merge the branch
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

  // 3. Remove worktree (use force since we're finishing - untracked files are expected)
  try {
    removeWorktree(worktree.path, true);
    console.log(chalk.green(`✓ Removed worktree: ${worktree.path}`));
  } catch (error) {
    // Don't exit - the merge succeeded, continue with remaining steps
    console.error(chalk.yellow(`⚠ Could not remove worktree automatically`));
    console.log(chalk.dim("  Clean up manually with:"));
    console.log(chalk.dim(`    git worktree remove "${worktree.path}" --force`));
  }

  // 4. Prune worktrees
  pruneWorktrees();

  // 5. Delete the branch (default: true)
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

  // 6. Commit doc changes (archived doc is now on main but not committed)
  if (config.docsEnabled && hasChangesInPath(config.docsDir)) {
    try {
      commitDocChanges(config.docsDir, targetName);
      console.log(chalk.green(`✓ Committed doc changes`));
    } catch (error) {
      console.log(chalk.yellow(`⚠ Could not commit doc changes`));
    }
  }

  // 7. Push if requested
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

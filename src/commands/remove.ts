import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import chalk from "chalk";
import type { RemoveOptions } from "../types.js";
import {
  deleteBranch,
  findWorktree,
  getRepoRoot,
  hasUncommittedChanges,
  listWorktrees,
  pruneWorktrees,
  removeWorktree,
} from "../lib/git.js";
import { loadConfig } from "../lib/config.js";
import { getActiveDocPath, getWorktreeDocPath } from "../lib/docs.js";

export async function removeCommand(
  name: string,
  options: RemoveOptions
): Promise<void> {
  const repoRoot = getRepoRoot();
  const config = await loadConfig(repoRoot);
  const worktrees = listWorktrees();

  // Find worktree by name (can match path or branch)
  const worktree = findWorktree(worktrees, name);

  if (!worktree) {
    console.error(chalk.red(`Worktree not found: ${name}`));
    console.log(chalk.dim("\nAvailable worktrees:"));
    for (const wt of worktrees) {
      console.log(chalk.dim(`  - ${wt.path} (${wt.branch})`));
    }
    process.exit(1);
  }

  // Don't allow removing the main worktree
  if (worktree.path === repoRoot) {
    console.error(chalk.red("Cannot remove the main worktree"));
    process.exit(1);
  }

  // Check if worktree is locked
  if (worktree.isLocked && !options.force) {
    console.error(chalk.red("Cannot remove a locked worktree"));
    console.log(chalk.dim("  Use --force to remove anyway, or unlock with:"));
    console.log(chalk.dim(`    git worktree unlock "${worktree.path}"`));
    process.exit(1);
  }

  const branchToDelete = worktree.branch;

  // WORKTREE.md is always untracked, so git alone would refuse every removal.
  // Check for real changes ourselves and let git force past the doc.
  if (!options.force && hasUncommittedChanges(worktree.path)) {
    console.error(chalk.red("Worktree has uncommitted changes"));
    console.log(chalk.dim("  Commit or stash them, or use --force to discard them."));
    process.exit(1);
  }

  // Remove worktree
  try {
    removeWorktree(worktree.path, true);
    console.log(chalk.green(`✓ Removed worktree: ${worktree.path}`));
  } catch (error) {
    console.error(chalk.red(`✗ Failed to remove worktree`));
    process.exit(1);
  }

  // Prune worktrees
  pruneWorktrees();

  // Clean up orphaned legacy active doc if it exists
  const worktreeName = worktree.path.split("/").pop() ?? name;
  const legacyDocPath = getActiveDocPath(repoRoot, config.docsDir, worktreeName);
  if (existsSync(legacyDocPath)) {
    try {
      await unlink(legacyDocPath);
      console.log(chalk.green(`✓ Removed orphaned doc: ${worktreeName}.md`));
    } catch {
      console.log(chalk.yellow(`⚠ Could not remove orphaned doc: ${worktreeName}.md`));
    }
  }

  // Optionally delete the branch
  if (options.deleteBranch && branchToDelete && branchToDelete !== "(detached)") {
    try {
      deleteBranch(branchToDelete, options.force ?? false);
      console.log(chalk.green(`✓ Deleted branch: ${branchToDelete}`));
    } catch (error) {
      console.error(
        chalk.yellow(`⚠ Could not delete branch: ${branchToDelete}`)
      );
      if (!options.force) {
        console.log(chalk.dim("  Tip: Use --force to force delete the branch"));
      }
    }
  }

  console.log(chalk.green("\n✓ Cleanup complete!"));
}

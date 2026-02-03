import chalk from "chalk";
import { listWorktrees, getRepoRoot } from "../lib/git.js";

export async function listCommand(): Promise<void> {
  try {
    getRepoRoot(); // Verify we're in a git repo
  } catch {
    console.error(chalk.red("Not in a git repository"));
    process.exit(1);
  }

  const worktrees = listWorktrees();

  if (worktrees.length === 0) {
    console.log(chalk.yellow("No worktrees found"));
    return;
  }

  console.log(chalk.blue.bold("Git Worktrees:\n"));

  for (const wt of worktrees) {
    const branchDisplay = wt.isBare
      ? chalk.dim("(bare)")
      : wt.branch === "(detached)"
        ? chalk.yellow(wt.branch)
        : chalk.green(wt.branch);

    console.log(`  ${chalk.bold(wt.path)}`);
    console.log(`    Branch: ${branchDisplay}`);
    console.log(`    Commit: ${chalk.dim(wt.commit?.slice(0, 8) ?? "N/A")}`);
    console.log();
  }
}

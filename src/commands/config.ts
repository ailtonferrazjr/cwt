import chalk from "chalk";
import { loadConfig, getDefaultConfig } from "../lib/config.js";
import { detectPackageManager } from "../lib/detect.js";
import { getRepoRoot } from "../lib/git.js";

export async function configCommand(): Promise<void> {
  let repoRoot: string;
  try {
    repoRoot = getRepoRoot();
  } catch {
    console.error(chalk.red("Not in a git repository"));
    process.exit(1);
  }

  const config = await loadConfig(repoRoot);
  const defaults = getDefaultConfig();
  const pm = detectPackageManager(repoRoot);

  console.log(chalk.blue.bold("Effective Configuration:\n"));

  console.log(chalk.bold("Repository:"));
  console.log(`  Root: ${chalk.dim(repoRoot)}`);
  console.log(`  Package Manager: ${pm ? chalk.green(pm) : chalk.dim("not detected")}`);
  console.log();

  console.log(chalk.bold("Files to Copy:"));
  if (config.copyFiles.length > 0) {
    for (const file of config.copyFiles) {
      const isDefault = defaults.copyFiles.includes(file);
      console.log(`  - ${file}${isDefault ? chalk.dim(" (default)") : ""}`);
    }
  } else {
    console.log(chalk.dim("  (none)"));
  }
  console.log();

  console.log(chalk.bold("Copy Patterns:"));
  if (config.copyPatterns.length > 0) {
    for (const pattern of config.copyPatterns) {
      console.log(`  - ${pattern}`);
    }
  } else {
    console.log(chalk.dim("  (none)"));
  }
  console.log();

  console.log(chalk.bold("Setup Commands:"));
  if (config.setupCommands.length > 0) {
    for (const cmd of config.setupCommands) {
      console.log(`  - ${cmd}`);
    }
  } else if (pm) {
    console.log(`  - ${pm} install ${chalk.dim("(auto-detected)")}`);
  } else {
    console.log(chalk.dim("  (none)"));
  }
  console.log();

  console.log(chalk.bold("Options:"));
  console.log(`  Worktree Directory: ${config.worktreeDir}`);
  console.log(`  Branch Prefix: ${config.branchPrefix || chalk.dim("(none)")}`);
  console.log(
    `  Post-Setup Message: ${config.postSetupMessage || chalk.dim("(none)")}`
  );
}

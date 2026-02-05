import { resolve } from "node:path";
import { execSync } from "node:child_process";
import chalk from "chalk";
import type { CreateOptions } from "../types.js";
import { loadConfig, resolveWorktreeDir } from "../lib/config.js";
import { detectPackageManager, getInstallCommand } from "../lib/detect.js";
import { copyEnvFiles } from "../lib/files.js";
import {
  branchExists,
  createWorktree,
  getRepoName,
  getRepoRoot,
} from "../lib/git.js";
import { runSetupCommands } from "../lib/setup.js";
import { createDocFromTemplate } from "../lib/docs.js";

function copyToClipboard(text: string): boolean {
  try {
    const platform = process.platform;
    if (platform === "darwin") {
      execSync("pbcopy", { input: text });
    } else if (platform === "win32") {
      execSync("clip", { input: text });
    } else {
      // Linux - try xclip first, then xsel
      try {
        execSync("xclip -selection clipboard", { input: text });
      } catch {
        execSync("xsel --clipboard --input", { input: text });
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function createCommand(
  name: string,
  options: CreateOptions
): Promise<void> {
  const repoRoot = getRepoRoot();
  const repoName = getRepoName(repoRoot);
  const config = await loadConfig(repoRoot);

  // Determine branch name
  const branchName = options.branch ?? `${config.branchPrefix}${name}`;

  // Determine worktree directory
  const worktreeDir = options.dir
    ? resolve(options.dir)
    : resolve(repoRoot, resolveWorktreeDir(config.worktreeDir, name, repoName));

  // Check if branch exists
  const existingBranch = branchExists(branchName);

  console.log(chalk.blue(`Creating worktree at ${chalk.bold(worktreeDir)}`));

  // Create worktree
  try {
    createWorktree(worktreeDir, branchName, !existingBranch);
    console.log(chalk.green(`✓ Created worktree`));
    if (!existingBranch) {
      console.log(chalk.green(`✓ Created branch: ${branchName}`));
    } else {
      console.log(chalk.green(`✓ Using existing branch: ${branchName}`));
    }
  } catch (error) {
    console.error(chalk.red(`✗ Failed to create worktree`));
    process.exit(1);
  }

  // Create documentation file in the worktree
  if (config.docsEnabled) {
    try {
      const docPath = await createDocFromTemplate(
        repoRoot,
        config.docsDir,
        name,
        branchName,
        worktreeDir
      );
      console.log(chalk.green(`✓ Created doc: WORKTREE.md`));
    } catch (error) {
      console.log(chalk.yellow(`⚠ Could not create documentation file`));
    }
  }

  // Copy environment files
  const copyResult = await copyEnvFiles(
    repoRoot,
    worktreeDir,
    config.copyFiles,
    config.copyPatterns
  );

  for (const file of copyResult.copied) {
    console.log(chalk.green(`✓ Copied ${file}`));
  }

  for (const { file, error } of copyResult.failed) {
    console.log(chalk.red(`✗ Failed to copy ${file}: ${error}`));
  }

  // Run setup commands
  if (!options.noInstall) {
    let commands = config.setupCommands;

    // If no custom commands, auto-detect package manager
    if (commands.length === 0) {
      const pm = detectPackageManager(repoRoot);
      if (pm) {
        commands = [getInstallCommand(pm)];
      }
    }

    if (commands.length > 0) {
      console.log(chalk.blue("\nRunning setup commands..."));
      const results = await runSetupCommands(commands, worktreeDir);

      for (const result of results) {
        if (result.success) {
          console.log(chalk.green(`✓ ${result.command}`));
        } else {
          console.log(chalk.red(`✗ ${result.command}: ${result.error}`));
        }
      }
    }
  }

  // Show post-setup message
  if (config.postSetupMessage) {
    console.log(chalk.cyan(`\n${config.postSetupMessage}`));
  }

  console.log(chalk.green("\n✓ Setup complete!"));

  const copied = copyToClipboard(worktreeDir);
  if (copied) {
    console.log(chalk.dim(`\ncd ${worktreeDir} ${chalk.cyan("(copied to clipboard)")}`));
  } else {
    console.log(chalk.dim(`\ncd ${worktreeDir}`));
  }
}

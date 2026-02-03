import { writeFile, readFile, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { getRepoRoot } from "../lib/git.js";
import { getDefaultConfig } from "../lib/config.js";
import { ensureDocsStructure, createDefaultTemplate } from "../lib/docs.js";

const CONFIG_FILENAME = ".worktreerc.json";
const GITIGNORE_ENTRY = ".worktrees/";

async function addToGitignore(repoRoot: string): Promise<boolean> {
  const gitignorePath = join(repoRoot, ".gitignore");

  // Check if .gitignore exists and already has the entry
  if (existsSync(gitignorePath)) {
    const content = await readFile(gitignorePath, "utf-8");
    const lines = content.split("\n").map((line) => line.trim());

    if (lines.includes(GITIGNORE_ENTRY) || lines.includes(".worktrees")) {
      return false; // Already exists
    }

    // Append to existing .gitignore
    const newEntry = content.endsWith("\n")
      ? `${GITIGNORE_ENTRY}\n`
      : `\n${GITIGNORE_ENTRY}\n`;
    await appendFile(gitignorePath, newEntry);
    return true;
  }

  // Create new .gitignore
  await writeFile(gitignorePath, `${GITIGNORE_ENTRY}\n`, "utf-8");
  return true;
}

export async function initCommand(options: { force?: boolean }): Promise<void> {
  const repoRoot = getRepoRoot();
  const configPath = join(repoRoot, CONFIG_FILENAME);

  let configCreated = false;

  if (existsSync(configPath) && !options.force) {
    console.log(chalk.yellow(`${CONFIG_FILENAME} already exists.`));
    console.log(chalk.dim(`Use --force to overwrite.`));
  } else {
    const config = getDefaultConfig();
    const content = JSON.stringify(config, null, 2) + "\n";
    await writeFile(configPath, content, "utf-8");
    configCreated = true;

    console.log(chalk.green(`✓ Created ${CONFIG_FILENAME}`));
    console.log(chalk.dim(`\nDefault configuration:`));
    console.log(chalk.dim(`  copyFiles: ${config.copyFiles.join(", ")}`));
    console.log(chalk.dim(`  worktreeDir: ${config.worktreeDir}`));
  }

  // Add .worktrees/ to .gitignore
  const gitignoreUpdated = await addToGitignore(repoRoot);
  if (gitignoreUpdated) {
    console.log(chalk.green(`✓ Added ${GITIGNORE_ENTRY} to .gitignore`));
  } else {
    console.log(chalk.dim(`  .gitignore already contains ${GITIGNORE_ENTRY}`));
  }

  // Initialize docs structure
  const config = getDefaultConfig();
  await ensureDocsStructure(repoRoot, config.docsDir);
  console.log(chalk.green(`✓ Created ${config.docsDir}/ structure`));

  const templateCreated = await createDefaultTemplate(repoRoot, config.docsDir);
  if (templateCreated) {
    console.log(chalk.green(`✓ Created worktree documentation template`));
  } else {
    console.log(chalk.dim(`  Documentation template already exists`));
  }

  if (configCreated) {
    console.log(chalk.dim(`\nEdit the config file to customize for this project.`));
  }

  console.log(chalk.dim(`\nDocumentation will be tracked in ${config.docsDir}/`));
}

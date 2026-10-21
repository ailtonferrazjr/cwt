import { createRequire } from "node:module";
import { Command } from "commander";
import { createCommand } from "./commands/create.js";
import { finishCommand } from "./commands/finish.js";
import { initCommand } from "./commands/init.js";
import { listCommand } from "./commands/list.js";
import { removeCommand } from "./commands/remove.js";
import { configCommand } from "./commands/config.js";
import { docsListCommand, docsViewCommand, docsOpenCommand } from "./commands/docs.js";
import { prCommand } from "./commands/pr.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("cwt")
    .description("CLI tool for managing git worktrees with automatic environment setup")
    .version(version);

  program
    .command("create <name>")
    .description("Create a new worktree with environment setup")
    .option("-b, --branch <branch>", "Branch name (default: uses name with optional prefix)")
    .option("-d, --dir <directory>", "Custom directory for the worktree")
    .option("--no-install", "Skip running setup commands")
    .action(createCommand);

  program
    .command("list")
    .alias("ls")
    .description("List all worktrees")
    .action(listCommand);

  program
    .command("remove <name>")
    .alias("rm")
    .description("Remove a worktree")
    .option("-f, --force", "Force remove even with uncommitted changes")
    .option("-D, --delete-branch", "Also delete the branch")
    .action(removeCommand);

  program
    .command("finish [name]")
    .description("Merge worktree branch into current branch and clean up")
    .option("-s, --self", "Auto-detect worktree from current directory")
    .option("-m, --message <message>", "Custom merge commit message")
    .option("--no-delete-branch", "Keep the branch after merge")
    .option("-p, --push", "Push to remote after merge")
    .action(finishCommand);

  program
    .command("config")
    .description("Show effective configuration for current project")
    .action(configCommand);

  program
    .command("init")
    .description("Create .worktreerc.json with default configuration")
    .option("-f, --force", "Overwrite existing config file")
    .action(initCommand);

  const docs = program
    .command("docs")
    .description("Manage worktree documentation");

  docs
    .command("list", { isDefault: true })
    .description("List all documentation")
    .option("-a, --active", "Show only active docs")
    .option("-c, --completed", "Show only completed docs")
    .action(docsListCommand);

  docs
    .command("view <name>")
    .description("View documentation for a worktree")
    .action(docsViewCommand);

  docs
    .command("path <name>")
    .description("Print path to documentation file")
    .action(docsOpenCommand);

  program
    .command("pr [name]")
    .description("Create a GitHub PR using worktree documentation")
    .option("-s, --self", "Auto-detect worktree from current directory")
    .option("-d, --draft", "Create as draft PR")
    .option("-w, --web", "Open PR in browser after creation")
    .action(prCommand);

  return program;
}

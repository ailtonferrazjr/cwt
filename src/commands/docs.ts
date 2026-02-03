import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { getRepoRoot } from "../lib/git.js";
import { loadConfig } from "../lib/config.js";
import {
  getDocsDir,
  DOCS_ACTIVE_DIR,
  DOCS_COMPLETED_DIR,
} from "../lib/docs.js";

export interface DocsOptions {
  active?: boolean;
  completed?: boolean;
}

interface DocEntry {
  name: string;
  path: string;
  type: "active" | "completed";
  date?: string;
}

async function listDocsInDir(
  dir: string,
  type: "active" | "completed"
): Promise<DocEntry[]> {
  if (!existsSync(dir)) {
    return [];
  }

  const files = await readdir(dir);
  return files
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const name = f.replace(".md", "");
      // For completed docs, extract date from filename (YYYY-MM-DD-name.md)
      const dateMatch = name.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
      return {
        name: dateMatch ? dateMatch[2] : name,
        path: join(dir, f),
        type,
        date: dateMatch ? dateMatch[1] : undefined,
      };
    })
    .sort((a, b) => {
      // Sort by date descending for completed, alphabetically for active
      if (type === "completed" && a.date && b.date) {
        return b.date.localeCompare(a.date);
      }
      return a.name.localeCompare(b.name);
    });
}

export async function docsListCommand(options: DocsOptions): Promise<void> {
  const repoRoot = getRepoRoot();
  const config = await loadConfig(repoRoot);

  if (!config.docsEnabled) {
    console.log(chalk.yellow("Documentation tracking is disabled."));
    console.log(chalk.dim('Enable it in .worktreerc.json: "docsEnabled": true'));
    return;
  }

  const docsDir = getDocsDir(repoRoot, config.docsDir);

  if (!existsSync(docsDir)) {
    console.log(chalk.yellow("No documentation directory found."));
    console.log(chalk.dim("Run `cwt init` to set up documentation tracking."));
    return;
  }

  const showActive = options.active || (!options.active && !options.completed);
  const showCompleted = options.completed || (!options.active && !options.completed);

  const activeDocs = showActive
    ? await listDocsInDir(join(docsDir, DOCS_ACTIVE_DIR), "active")
    : [];
  const completedDocs = showCompleted
    ? await listDocsInDir(join(docsDir, DOCS_COMPLETED_DIR), "completed")
    : [];

  if (activeDocs.length === 0 && completedDocs.length === 0) {
    console.log(chalk.dim("No documentation found."));
    return;
  }

  if (activeDocs.length > 0) {
    console.log(chalk.blue.bold("\nActive"));
    console.log(chalk.dim("─".repeat(40)));
    for (const doc of activeDocs) {
      console.log(`  ${chalk.green("●")} ${doc.name}`);
    }
  }

  if (completedDocs.length > 0) {
    console.log(chalk.blue.bold("\nCompleted"));
    console.log(chalk.dim("─".repeat(40)));
    for (const doc of completedDocs) {
      console.log(`  ${chalk.dim("○")} ${doc.name} ${chalk.dim(`(${doc.date})`)}`);
    }
  }

  console.log();
}

export async function docsViewCommand(name: string): Promise<void> {
  const repoRoot = getRepoRoot();
  const config = await loadConfig(repoRoot);
  const docsDir = getDocsDir(repoRoot, config.docsDir);

  // Try to find the doc in active or completed
  const activeDir = join(docsDir, DOCS_ACTIVE_DIR);
  const completedDir = join(docsDir, DOCS_COMPLETED_DIR);

  // Check active first
  const activePath = join(activeDir, `${name}.md`);
  if (existsSync(activePath)) {
    const content = await readFile(activePath, "utf-8");
    console.log(chalk.blue.bold(`\n📄 ${name} (active)\n`));
    console.log(content);
    return;
  }

  // Check completed (need to search for files ending with -name.md)
  if (existsSync(completedDir)) {
    const files = await readdir(completedDir);
    const matchingFile = files.find(
      (f) => f.endsWith(`-${name}.md`) || f === `${name}.md`
    );

    if (matchingFile) {
      const content = await readFile(join(completedDir, matchingFile), "utf-8");
      console.log(chalk.blue.bold(`\n📄 ${name} (completed)\n`));
      console.log(content);
      return;
    }
  }

  console.error(chalk.red(`Documentation not found: ${name}`));
  console.log(chalk.dim("\nUse `cwt docs` to list available documentation."));
  process.exit(1);
}

export async function docsOpenCommand(name: string): Promise<void> {
  const repoRoot = getRepoRoot();
  const config = await loadConfig(repoRoot);
  const docsDir = getDocsDir(repoRoot, config.docsDir);

  // Try to find the doc path
  const activeDir = join(docsDir, DOCS_ACTIVE_DIR);
  const completedDir = join(docsDir, DOCS_COMPLETED_DIR);

  // Check active first
  const activePath = join(activeDir, `${name}.md`);
  if (existsSync(activePath)) {
    console.log(activePath);
    return;
  }

  // Check completed
  if (existsSync(completedDir)) {
    const files = await readdir(completedDir);
    const matchingFile = files.find(
      (f) => f.endsWith(`-${name}.md`) || f === `${name}.md`
    );

    if (matchingFile) {
      console.log(join(completedDir, matchingFile));
      return;
    }
  }

  console.error(chalk.red(`Documentation not found: ${name}`));
  process.exit(1);
}

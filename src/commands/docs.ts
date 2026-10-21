import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import chalk from "chalk";
import { getRepoRoot, listWorktrees } from "../lib/git.js";
import { loadConfig } from "../lib/config.js";
import {
  getDocsDir,
  DOCS_ACTIVE_DIR,
  DOCS_COMPLETED_DIR,
  getWorktreeDocPath,
  findCompletedDoc,
  parseCompletedDocFilename,
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

async function listCompletedDocs(dir: string): Promise<DocEntry[]> {
  if (!existsSync(dir)) {
    return [];
  }

  const files = await readdir(dir);
  return files
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({
      ...parseCompletedDocFilename(f),
      path: join(dir, f),
      type: "completed" as const,
    }))
    .sort((a, b) => {
      if (a.date && b.date) {
        return b.date.localeCompare(a.date);
      }
      return a.name.localeCompare(b.name);
    });
}

/**
 * Find active docs by looking for WORKTREE.md in each worktree
 */
async function listActiveDocs(repoRoot: string): Promise<DocEntry[]> {
  const worktrees = listWorktrees();
  const activeDocs: DocEntry[] = [];

  for (const wt of worktrees) {
    // Skip the main worktree
    if (wt.path === repoRoot) continue;

    const docPath = getWorktreeDocPath(wt.path);
    if (existsSync(docPath)) {
      // Extract worktree name from path (last segment)
      const name = basename(wt.path) || wt.branch || "unknown";
      activeDocs.push({
        name,
        path: docPath,
        type: "active",
      });
    }
  }

  return activeDocs.sort((a, b) => a.name.localeCompare(b.name));
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

  // Active docs now live in worktrees as WORKTREE.md
  const activeDocs = showActive ? await listActiveDocs(repoRoot) : [];
  const completedDocs = showCompleted
    ? await listCompletedDocs(join(docsDir, DOCS_COMPLETED_DIR))
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
      const date = doc.date ? ` ${chalk.dim(`(${doc.date})`)}` : "";
      console.log(`  ${chalk.dim("○")} ${doc.name}${date}`);
    }
  }

  console.log();
}

export async function docsViewCommand(name: string): Promise<void> {
  const repoRoot = getRepoRoot();
  const config = await loadConfig(repoRoot);
  const docsDir = getDocsDir(repoRoot, config.docsDir);

  // Check active docs in worktrees first
  const worktrees = listWorktrees();
  for (const wt of worktrees) {
    if (wt.path === repoRoot) continue;
    const wtName = basename(wt.path);
    if (wtName === name) {
      const docPath = getWorktreeDocPath(wt.path);
      if (existsSync(docPath)) {
        const content = await readFile(docPath, "utf-8");
        console.log(chalk.blue.bold(`\n📄 ${name} (active)\n`));
        console.log(content);
        return;
      }
    }
  }

  // Check completed (need to search for files ending with -name.md)
  const completedDir = join(docsDir, DOCS_COMPLETED_DIR);
  if (existsSync(completedDir)) {
    const files = await readdir(completedDir);
    const matchingFile = findCompletedDoc(files, name);

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

  // Check active docs in worktrees first
  const worktrees = listWorktrees();
  for (const wt of worktrees) {
    if (wt.path === repoRoot) continue;
    const wtName = basename(wt.path);
    if (wtName === name) {
      const docPath = getWorktreeDocPath(wt.path);
      if (existsSync(docPath)) {
        console.log(docPath);
        return;
      }
    }
  }

  // Check completed
  const completedDir = join(docsDir, DOCS_COMPLETED_DIR);
  if (existsSync(completedDir)) {
    const files = await readdir(completedDir);
    const matchingFile = findCompletedDoc(files, name);

    if (matchingFile) {
      console.log(join(completedDir, matchingFile));
      return;
    }
  }

  console.error(chalk.red(`Documentation not found: ${name}`));
  process.exit(1);
}

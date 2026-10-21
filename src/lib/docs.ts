import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export const DOCS_TEMPLATE_FILE = "worktree.md";
export const DOCS_ACTIVE_DIR = "active";
export const DOCS_COMPLETED_DIR = "completed";
export const DOCS_TEMPLATES_DIR = "templates";

export const DEFAULT_TEMPLATE = `---
tags: []
domains: []
related: []
---

# {name}

**Branch:** \`{branch}\`
**Created:** {date}

## Problem

<!--
What problem does this worktree solve? Be specific:
- What's broken or missing?
- Who is affected?
- What's the impact?
-->

## Context

<!--
Background info for future reference:
- Related issues/PRs/docs
- Key files involved
- Dependencies or constraints
-->

## Plan

<!--
The approach to solve the problem:
- Key steps
- Technical decisions and tradeoffs
- Risks or unknowns
-->

## Changes

<!--
What was actually implemented:
- Key changes made
- Files modified
- Any deviations from the plan
-->

## Testing

<!--
How was this verified:
- Manual testing done
- Automated tests added
- Edge cases covered
-->

## Learnings

<!--
Knowledge to preserve:
- Patterns discovered
- Gotchas to remember
- Future improvements
-->

## Related Worktrees

<!--
Link to previous work this builds on or relates to:
- [worktree-name](../completed/YYYY-MM-DD-worktree-name.md) - brief description
Use /cwt-search to find relevant past work
-->

---

## Commits

<!-- Auto-populated on finish -->
`;

export function getDocsDir(repoRoot: string, docsDir: string): string {
  return join(repoRoot, docsDir);
}

export const WORKTREE_DOC_FILENAME = "WORKTREE.md";

export function getActiveDocPath(
  repoRoot: string,
  docsDir: string,
  name: string
): string {
  return join(repoRoot, docsDir, DOCS_ACTIVE_DIR, `${name}.md`);
}

/**
 * Get path to the worktree doc (lives in the worktree root)
 */
export function getWorktreeDocPath(worktreeDir: string): string {
  return join(worktreeDir, WORKTREE_DOC_FILENAME);
}

export function getCompletedDocPath(
  repoRoot: string,
  docsDir: string,
  name: string,
  date: Date
): string {
  const dateStr = formatDateForFilename(date);
  return join(repoRoot, docsDir, DOCS_COMPLETED_DIR, `${dateStr}-${name}.md`);
}

export function getTemplatePath(repoRoot: string, docsDir: string): string {
  return join(repoRoot, docsDir, DOCS_TEMPLATES_DIR, DOCS_TEMPLATE_FILE);
}

export function formatDateForFilename(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function formatDateForDisplay(date: Date): string {
  return date.toISOString().replace("T", " ").split(".")[0];
}

/**
 * Fill the {name}, {branch} and {date} placeholders of a doc template.
 */
export function renderTemplate(
  template: string,
  vars: { name: string; branch: string; date: Date }
): string {
  return template
    .replace(/\{name\}/g, vars.name)
    .replace(/\{branch\}/g, vars.branch)
    .replace(/\{date\}/g, formatDateForDisplay(vars.date));
}

export const COMMITS_PLACEHOLDER = "<!-- Auto-populated on finish -->";

/**
 * Add the completion timestamp and commit list to a worktree doc.
 * Docs created from the default template have a placeholder that gets
 * replaced in place; custom docs get a completion section appended.
 */
export function addCompletionInfo(
  content: string,
  commits: string[],
  completedAt: Date
): string {
  const completed = formatDateForDisplay(completedAt);
  const commitList = commits.map((c) => `- \`${c}\``).join("\n");

  if (content.includes(COMMITS_PLACEHOLDER)) {
    return content
      .replace(COMMITS_PLACEHOLDER, commits.length > 0 ? commitList : "_No commits_")
      .replace(/(\*\*Created:\*\* [^\n]+)/, `$1\n**Completed:** ${completed}`);
  }

  return `${content}
---

**Completed:** ${completed}

### Commits

${commits.length > 0 ? commitList : "_No commits found_"}
`;
}

export interface CompletedDocName {
  name: string;
  date?: string;
}

/**
 * Split an archived doc filename (YYYY-MM-DD-name.md) into date and name.
 */
export function parseCompletedDocFilename(filename: string): CompletedDocName {
  const base = filename.replace(/\.md$/, "");
  const match = base.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  return match ? { name: match[2], date: match[1] } : { name: base };
}

/**
 * Pick the archived doc for a worktree name. When the same name was
 * finished more than once, the most recent doc wins.
 */
export function findCompletedDoc(files: string[], name: string): string | undefined {
  return files
    .filter((f) => f.endsWith(".md") && parseCompletedDocFilename(f).name === name)
    .sort()
    .pop();
}

export async function ensureDocsStructure(
  repoRoot: string,
  docsDir: string
): Promise<void> {
  const baseDir = getDocsDir(repoRoot, docsDir);
  const dirs = [
    baseDir,
    join(baseDir, DOCS_TEMPLATES_DIR),
    join(baseDir, DOCS_ACTIVE_DIR),
    join(baseDir, DOCS_COMPLETED_DIR),
  ];

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }
}

export async function createDefaultTemplate(
  repoRoot: string,
  docsDir: string
): Promise<boolean> {
  const templatePath = getTemplatePath(repoRoot, docsDir);

  if (existsSync(templatePath)) {
    return false;
  }

  await writeFile(templatePath, DEFAULT_TEMPLATE, "utf-8");
  return true;
}

export async function createDocFromTemplate(
  repoRoot: string,
  docsDir: string,
  name: string,
  branch: string,
  worktreeDir?: string
): Promise<string> {
  // Ensure docs structure exists in main repo (for templates and completed docs)
  await ensureDocsStructure(repoRoot, docsDir);

  const templatePath = getTemplatePath(repoRoot, docsDir);

  // If worktreeDir provided, create doc in worktree; otherwise use legacy location
  const docPath = worktreeDir
    ? getWorktreeDocPath(worktreeDir)
    : getActiveDocPath(repoRoot, docsDir, name);

  let template = DEFAULT_TEMPLATE;

  if (existsSync(templatePath)) {
    template = await readFile(templatePath, "utf-8");
  }

  const content = renderTemplate(template, { name, branch, date: new Date() });

  await writeFile(docPath, content, "utf-8");

  return docPath;
}

export function getCommitsForBranch(branch: string, baseBranch = "main"): string[] {
  try {
    // Use spawnSync to avoid shell injection with branch names
    const result = spawnSync(
      "git",
      ["log", `${baseBranch}..${branch}`, "--pretty=format:%h %s"],
      { encoding: "utf-8", stdio: "pipe" }
    );

    const output = (result.stdout || "").trim();
    if (!output) {
      return [];
    }

    return output.split("\n");
  } catch {
    return [];
  }
}

export function getCurrentBaseBranch(): string {
  try {
    // Try to get the default branch from remote
    const result = spawnSync(
      "git",
      ["symbolic-ref", "refs/remotes/origin/HEAD"],
      { encoding: "utf-8", stdio: "pipe" }
    );

    if (result.status === 0 && result.stdout) {
      return result.stdout.trim().replace("refs/remotes/origin/", "");
    }

    // Fallback: check if 'main' or 'master' branch exists
    const mainCheck = spawnSync("git", ["rev-parse", "--verify", "main"], {
      encoding: "utf-8",
      stdio: "pipe",
    });
    if (mainCheck.status === 0) {
      return "main";
    }

    const masterCheck = spawnSync("git", ["rev-parse", "--verify", "master"], {
      encoding: "utf-8",
      stdio: "pipe",
    });
    if (masterCheck.status === 0) {
      return "master";
    }

    return "main";
  } catch {
    return "main";
  }
}

export async function archiveDoc(
  repoRoot: string,
  docsDir: string,
  name: string,
  branch: string,
  worktreeDir?: string
): Promise<{ archived: boolean; path: string | null }> {
  // Check worktree location first, fall back to legacy active location
  const worktreeDocPath = worktreeDir ? getWorktreeDocPath(worktreeDir) : null;
  const legacyDocPath = getActiveDocPath(repoRoot, docsDir, name);

  const activeDocPath = worktreeDocPath && existsSync(worktreeDocPath)
    ? worktreeDocPath
    : legacyDocPath;

  if (!existsSync(activeDocPath)) {
    return { archived: false, path: null };
  }

  const now = new Date();
  const completedPath = getCompletedDocPath(repoRoot, docsDir, name, now);

  const content = addCompletionInfo(
    await readFile(activeDocPath, "utf-8"),
    getCommitsForBranch(branch, getCurrentBaseBranch()),
    now
  );

  // Ensure completed directory exists
  await ensureDocsStructure(repoRoot, docsDir);

  // Write to completed location
  await writeFile(completedPath, content, "utf-8");

  // Remove from active
  await unlink(activeDocPath);

  return { archived: true, path: completedPath };
}

export function activeDocExists(
  repoRoot: string,
  docsDir: string,
  name: string,
  worktreeDir?: string
): boolean {
  // Check worktree location first, then legacy location
  if (worktreeDir && existsSync(getWorktreeDocPath(worktreeDir))) {
    return true;
  }
  return existsSync(getActiveDocPath(repoRoot, docsDir, name));
}

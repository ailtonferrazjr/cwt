import { readFile, writeFile, mkdir, rename, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import type { WorktreeDocMetadata } from "../types.js";

export const DOCS_TEMPLATE_FILE = "worktree.md";
export const DOCS_ACTIVE_DIR = "active";
export const DOCS_COMPLETED_DIR = "completed";
export const DOCS_TEMPLATES_DIR = "templates";

export const DEFAULT_TEMPLATE = `# {name}

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

function formatDateForFilename(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatDateForDisplay(date: Date): string {
  return date.toISOString().replace("T", " ").split(".")[0];
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

  const now = new Date();
  const content = template
    .replace(/\{name\}/g, name)
    .replace(/\{branch\}/g, branch)
    .replace(/\{date\}/g, formatDateForDisplay(now));

  await writeFile(docPath, content, "utf-8");

  return docPath;
}

export function getCommitsForBranch(branch: string, baseBranch = "main"): string[] {
  try {
    const output = execSync(
      `git log ${baseBranch}..${branch} --pretty=format:"%h %s"`,
      { encoding: "utf-8" }
    );

    if (!output.trim()) {
      return [];
    }

    return output.trim().split("\n");
  } catch {
    return [];
  }
}

export function getCurrentBaseBranch(): string {
  try {
    // Try to get the default branch from remote
    const result = execSync(
      "git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null || echo refs/heads/main",
      { encoding: "utf-8" }
    );
    return result.trim().replace("refs/remotes/origin/", "").replace("refs/heads/", "");
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

  // Read current doc content
  let content = await readFile(activeDocPath, "utf-8");

  // Get commits for this branch
  const baseBranch = getCurrentBaseBranch();
  const commits = getCommitsForBranch(branch, baseBranch);

  // Append completion metadata
  const completionSection = `
---

**Completed:** ${formatDateForDisplay(now)}

### Commits

${commits.length > 0 ? commits.map((c) => `- \`${c}\``).join("\n") : "_No commits found_"}
`;

  // Replace the commits placeholder section or append
  if (content.includes("<!-- Auto-populated on finish -->")) {
    content = content.replace(
      "<!-- Auto-populated on finish -->",
      commits.length > 0
        ? commits.map((c) => `- \`${c}\``).join("\n")
        : "_No commits_"
    );
    // Add completion timestamp at the top after the date
    content = content.replace(
      /(\*\*Created:\*\* [^\n]+)/,
      `$1\n**Completed:** ${formatDateForDisplay(now)}`
    );
  } else {
    content += completionSection;
  }

  // Ensure completed directory exists
  await ensureDocsStructure(repoRoot, docsDir);

  // Write to completed location
  await writeFile(completedPath, content, "utf-8");

  // Remove from active
  const { unlink } = await import("node:fs/promises");
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

import { execSync, spawnSync } from "node:child_process";
import { basename } from "node:path";
import type { WorktreeInfo } from "../types.js";

export function getRepoRoot(): string {
  return execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim();
}

export function getRepoName(repoRoot: string): string {
  return basename(repoRoot);
}

export function getCurrentBranch(): string {
  return execSync("git branch --show-current", { encoding: "utf-8" }).trim();
}

export function branchExists(branch: string): boolean {
  const result = spawnSync("git", ["rev-parse", "--verify", branch], {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  return result.status === 0;
}

export function createWorktree(
  path: string,
  branch: string,
  createBranch: boolean
): void {
  const args = ["worktree", "add"];
  if (createBranch) {
    args.push("-b", branch);
  }
  args.push(path);
  if (!createBranch) {
    args.push(branch);
  }

  const result = spawnSync("git", args, {
    encoding: "utf-8",
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`Failed to create worktree`);
  }
}

export function removeWorktree(path: string, force: boolean): void {
  const args = ["worktree", "remove"];
  if (force) {
    args.push("--force");
  }
  args.push(path);

  const result = spawnSync("git", args, {
    encoding: "utf-8",
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`Failed to remove worktree`);
  }
}

export function deleteBranch(branch: string, force: boolean): void {
  const flag = force ? "-D" : "-d";
  const result = spawnSync("git", ["branch", flag, branch], {
    encoding: "utf-8",
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`Failed to delete branch: ${branch}`);
  }
}

export function listWorktrees(): WorktreeInfo[] {
  const output = execSync("git worktree list --porcelain", { encoding: "utf-8" });
  const worktrees: WorktreeInfo[] = [];
  let current: Partial<WorktreeInfo> = {};

  for (const line of output.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current.path) {
        worktrees.push(current as WorktreeInfo);
      }
      current = { path: line.slice(9), isBare: false };
    } else if (line.startsWith("HEAD ")) {
      current.commit = line.slice(5);
    } else if (line.startsWith("branch ")) {
      current.branch = line.slice(7).replace("refs/heads/", "");
    } else if (line === "bare") {
      current.isBare = true;
    } else if (line === "detached") {
      current.branch = "(detached)";
    }
  }

  if (current.path) {
    worktrees.push(current as WorktreeInfo);
  }

  return worktrees;
}

export function pruneWorktrees(): void {
  spawnSync("git", ["worktree", "prune"], {
    encoding: "utf-8",
    stdio: "inherit",
  });
}

export function mergeBranch(branch: string): void {
  const result = spawnSync("git", ["merge", branch], {
    encoding: "utf-8",
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`Failed to merge branch: ${branch}`);
  }
}

export function pushToRemote(): void {
  const result = spawnSync("git", ["push"], {
    encoding: "utf-8",
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error("Failed to push to remote");
  }
}

export interface WorktreeContext {
  isWorktree: boolean;
  worktreeName: string | null;
  mainRepoPath: string | null;
}

/**
 * Detect if the current directory is inside a .worktrees/ folder
 * Returns context about the worktree location
 */
export function detectWorktreeContext(): WorktreeContext {
  const cwd = process.cwd();
  const worktreesMarker = "/.worktrees/";

  const markerIndex = cwd.indexOf(worktreesMarker);
  if (markerIndex === -1) {
    return { isWorktree: false, worktreeName: null, mainRepoPath: null };
  }

  const mainRepoPath = cwd.slice(0, markerIndex);
  const afterMarker = cwd.slice(markerIndex + worktreesMarker.length);
  // Get just the worktree folder name (first path segment after .worktrees/)
  const worktreeName = afterMarker.split("/")[0];

  return {
    isWorktree: true,
    worktreeName,
    mainRepoPath,
  };
}

export function mergeBranchWithMessage(branch: string, message: string): void {
  const result = spawnSync("git", ["merge", branch, "-m", message], {
    encoding: "utf-8",
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`Failed to merge branch: ${branch}`);
  }
}

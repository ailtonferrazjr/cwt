export interface WorktreeConfig {
  /** Explicit files to copy (relative paths) */
  copyFiles: string[];
  /** Glob patterns for files to copy */
  copyPatterns: string[];
  /** Commands to run after copying files */
  setupCommands: string[];
  /** Directory pattern for worktrees. Supports {name} and {repo} placeholders */
  worktreeDir: string;
  /** Default branch prefix when creating new branches */
  branchPrefix: string;
  /** Message to display after setup */
  postSetupMessage: string | null;
  /** Enable worktree documentation tracking */
  docsEnabled: boolean;
  /** Directory for worktree documentation (relative to repo root) */
  docsDir: string;
  /** Commands to run before finishing worktree (typecheck, lint, test) */
  testCommands: string[];
  /** Whether to require tests to pass before finishing */
  requireTestsOnFinish: boolean;
  /** Test execution timeout in milliseconds */
  testTimeout: number;
}

export interface CreateOptions {
  branch?: string;
  dir?: string;
  /** Set to false by commander when --no-install is passed */
  install?: boolean;
}

export interface RemoveOptions {
  force?: boolean;
  deleteBranch?: boolean;
}

export interface FinishOptions {
  deleteBranch?: boolean;
  push?: boolean;
  self?: boolean;
  message?: string;
}

export interface WorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  isBare: boolean;
  isLocked: boolean;
}

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export interface WorktreeDocMetadata {
  name: string;
  branch: string;
  createdAt: string;
  completedAt?: string;
  commits?: string[];
}

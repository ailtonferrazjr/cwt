import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { vi } from "vitest";
import { buildProgram } from "../src/cli.js";

export function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf-8", stdio: "pipe" }).trim();
}

export function writeFiles(root: string, files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
}

export function makeTempDir(prefix = "cwt-test-"): string {
  // realpath: on macOS tmpdir() is a symlink and git reports the resolved path
  return realpathSync(mkdtempSync(join(tmpdir(), prefix)));
}

/**
 * Create a git repo with one commit on main. Files passed in are committed.
 */
export function createRepo(files: Record<string, string> = {}): string {
  const repo = join(makeTempDir(), "app");
  mkdirSync(repo);
  git(repo, "init", "-q", "-b", "main");
  writeFiles(repo, { "README.md": "# app\n", ...files });
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "initial commit");
  return repo;
}

export function removeDir(path: string): void {
  rmSync(dirname(path), { recursive: true, force: true });
}

class ExitError extends Error {
  constructor(public code: number) {
    super(`process.exit(${code})`);
  }
}

export interface RunResult {
  exitCode: number;
  output: string;
}

/**
 * Run the real CLI program in-process from `cwd`, capturing console output
 * and turning process.exit into a returned exit code.
 */
export async function runCli(cwd: string, args: string[]): Promise<RunResult> {
  const lines: string[] = [];
  const capture = (...parts: unknown[]) => {
    lines.push(parts.map(String).join(" "));
  };
  const log = vi.spyOn(console, "log").mockImplementation(capture);
  const error = vi.spyOn(console, "error").mockImplementation(capture);
  const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new ExitError(Number(code ?? 0));
  });
  const previousCwd = process.cwd();
  process.chdir(cwd);

  let exitCode = 0;
  try {
    await buildProgram().parseAsync(["node", "cwt", ...args]);
  } catch (err) {
    if (err instanceof ExitError) {
      exitCode = err.code;
    } else {
      throw err;
    }
  } finally {
    process.chdir(previousCwd);
    log.mockRestore();
    error.mockRestore();
    exit.mockRestore();
  }

  return { exitCode, output: lines.join("\n") };
}

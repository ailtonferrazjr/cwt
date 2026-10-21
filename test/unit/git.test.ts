import { describe, expect, it } from "vitest";
import { detectWorktreeContext, findWorktree, parseWorktreeList } from "../../src/lib/git.js";

const porcelain = `worktree /code/app
HEAD 1111111111111111111111111111111111111111
branch refs/heads/main

worktree /code/app/.worktrees/auth
HEAD 2222222222222222222222222222222222222222
branch refs/heads/feature/auth

worktree /code/app/.worktrees/spike
HEAD 3333333333333333333333333333333333333333
detached

worktree /code/app/.worktrees/old
HEAD 4444444444444444444444444444444444444444
branch refs/heads/old
locked reason: on a USB drive
`;

describe("parseWorktreeList", () => {
  const worktrees = parseWorktreeList(porcelain);

  it("parses every worktree with path, commit and branch", () => {
    expect(worktrees).toHaveLength(4);
    expect(worktrees[0]).toEqual({
      path: "/code/app",
      commit: "1111111111111111111111111111111111111111",
      branch: "main",
      isBare: false,
      isLocked: false,
    });
  });

  it("keeps slashes in branch names", () => {
    expect(worktrees[1].branch).toBe("feature/auth");
  });

  it("marks detached and locked worktrees", () => {
    expect(worktrees[2].branch).toBe("(detached)");
    expect(worktrees[3].isLocked).toBe(true);
  });

  it("recognizes bare repositories", () => {
    const [bare] = parseWorktreeList("worktree /code/app.git\nbare\n");
    expect(bare).toEqual({ path: "/code/app.git", isBare: true, isLocked: false });
  });

  it("returns an empty list for empty output", () => {
    expect(parseWorktreeList("")).toEqual([]);
  });
});

describe("findWorktree", () => {
  const worktrees = parseWorktreeList(porcelain);

  it("finds by directory name", () => {
    expect(findWorktree(worktrees, "auth")?.branch).toBe("feature/auth");
  });

  it("finds by branch name", () => {
    expect(findWorktree(worktrees, "feature/auth")?.path).toBe("/code/app/.worktrees/auth");
  });

  it("finds by path relative to the working directory", () => {
    expect(findWorktree(worktrees, ".worktrees/old", "/code/app")?.branch).toBe("old");
  });

  it("returns undefined for unknown names", () => {
    expect(findWorktree(worktrees, "nope")).toBeUndefined();
  });
});

describe("detectWorktreeContext", () => {
  it("detects the worktree name and main repo from a nested path", () => {
    expect(detectWorktreeContext("/code/app/.worktrees/auth/src/lib")).toEqual({
      isWorktree: true,
      worktreeName: "auth",
      mainRepoPath: "/code/app",
    });
  });

  it("reports when the directory is not inside .worktrees/", () => {
    expect(detectWorktreeContext("/code/app/src").isWorktree).toBe(false);
  });
});

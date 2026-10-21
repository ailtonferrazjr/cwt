import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRepo, git, removeDir, runCli, writeFiles } from "../helpers.js";

let repo: string;
afterEach(() => {
  if (repo) removeDir(repo);
});

function worktreeBranches(cwd: string): string[] {
  return git(cwd, "worktree", "list", "--porcelain")
    .split("\n")
    .filter((line) => line.startsWith("branch "))
    .map((line) => line.replace("branch refs/heads/", ""));
}

function setConfig(config: object): void {
  writeFileSync(join(repo, ".worktreerc.json"), JSON.stringify(config));
}

describe("cwt init", () => {
  it("writes config, ignores .worktrees/ and creates the docs structure", async () => {
    repo = createRepo({ ".gitignore": "node_modules/" });

    const { exitCode } = await runCli(repo, ["init"]);

    expect(exitCode).toBe(0);
    const config = JSON.parse(readFileSync(join(repo, ".worktreerc.json"), "utf-8"));
    expect(config.worktreeDir).toBe(".worktrees/{name}");
    expect(readFileSync(join(repo, ".gitignore"), "utf-8")).toBe("node_modules/\n.worktrees/\n");
    expect(existsSync(join(repo, ".worktree-docs/templates/worktree.md"))).toBe(true);
    expect(existsSync(join(repo, ".worktree-docs/completed"))).toBe(true);
  });

  it("is safe to run twice", async () => {
    repo = createRepo();
    await runCli(repo, ["init"]);
    writeFileSync(join(repo, ".worktreerc.json"), '{"branchPrefix":"feat/"}');

    await runCli(repo, ["init"]);

    expect(readFileSync(join(repo, ".worktreerc.json"), "utf-8")).toBe('{"branchPrefix":"feat/"}');
    expect(readFileSync(join(repo, ".gitignore"), "utf-8")).toBe(".worktrees/\n");
  });
});

describe("cwt create", () => {
  it("creates a worktree on a new branch with env files and WORKTREE.md", async () => {
    repo = createRepo({ ".gitignore": ".env\n.worktrees/\n" });
    writeFiles(repo, { ".env": "SECRET=1", ".claude/commands/start.md": "# start" });

    const { exitCode } = await runCli(repo, ["create", "auth"]);

    expect(exitCode).toBe(0);
    const wt = join(repo, ".worktrees/auth");
    expect(worktreeBranches(repo)).toContain("auth");
    expect(readFileSync(join(wt, ".env"), "utf-8")).toBe("SECRET=1");
    expect(existsSync(join(wt, ".claude/commands/start.md"))).toBe(true);

    const doc = readFileSync(join(wt, "WORKTREE.md"), "utf-8");
    expect(doc).toContain("# auth\n");
    expect(doc).toContain("**Branch:** `auth`");
  });

  it("applies branchPrefix and runs setup commands inside the worktree", async () => {
    repo = createRepo();
    setConfig({ branchPrefix: "feature/", setupCommands: ["echo ok > setup.txt"] });

    await runCli(repo, ["create", "search"]);

    expect(worktreeBranches(repo)).toContain("feature/search");
    expect(readFileSync(join(repo, ".worktrees/search/setup.txt"), "utf-8").trim()).toBe("ok");
  });

  it("skips setup commands with --no-install", async () => {
    repo = createRepo();
    setConfig({ setupCommands: ["echo ok > setup.txt"] });

    await runCli(repo, ["create", "search", "--no-install"]);

    expect(existsSync(join(repo, ".worktrees/search"))).toBe(true);
    expect(existsSync(join(repo, ".worktrees/search/setup.txt"))).toBe(false);
  });

  it("refuses a branch that is already checked out", async () => {
    repo = createRepo();

    const { exitCode, output } = await runCli(repo, ["create", "other", "-b", "main"]);

    expect(exitCode).toBe(1);
    expect(output).toContain("Branch 'main' is already checked out");
    expect(existsSync(join(repo, ".worktrees/other"))).toBe(false);
  });
});

describe("cwt remove", () => {
  it("removes a fresh worktree even though WORKTREE.md is untracked", async () => {
    repo = createRepo();
    await runCli(repo, ["create", "auth"]);

    const { exitCode } = await runCli(repo, ["remove", "auth", "-D"]);

    expect(exitCode).toBe(0);
    expect(existsSync(join(repo, ".worktrees/auth"))).toBe(false);
    expect(git(repo, "branch", "--list", "auth")).toBe("");
  });

  it("refuses to drop uncommitted work unless forced", async () => {
    repo = createRepo();
    await runCli(repo, ["create", "auth"]);
    writeFileSync(join(repo, ".worktrees/auth/wip.ts"), "export {};");

    const refused = await runCli(repo, ["remove", "auth"]);
    expect(refused.exitCode).toBe(1);
    expect(existsSync(join(repo, ".worktrees/auth/wip.ts"))).toBe(true);

    const forced = await runCli(repo, ["remove", "auth", "--force"]);
    expect(forced.exitCode).toBe(0);
    expect(existsSync(join(repo, ".worktrees/auth"))).toBe(false);
  });
});

describe("cwt finish", () => {
  async function createWithCommit(name: string): Promise<string> {
    await runCli(repo, ["create", name]);
    const wt = join(repo, ".worktrees", name);
    writeFileSync(join(wt, "feature.txt"), "done\n");
    git(wt, "add", "feature.txt");
    git(wt, "commit", "-q", "-m", "feat: add feature file");
    return wt;
  }

  it("merges, archives the doc with commits, and cleans up", async () => {
    repo = createRepo({ ".gitignore": ".worktrees/\n" });
    const wt = await createWithCommit("auth");

    const { exitCode } = await runCli(repo, ["finish", "auth"]);

    expect(exitCode).toBe(0);
    expect(readFileSync(join(repo, "feature.txt"), "utf-8")).toBe("done\n");
    expect(existsSync(wt)).toBe(false);
    expect(git(repo, "branch", "--list", "auth")).toBe("");

    const completed = readdirSync(join(repo, ".worktree-docs/completed"));
    expect(completed).toHaveLength(1);
    expect(completed[0]).toMatch(/^\d{4}-\d{2}-\d{2}-auth\.md$/);
    const archived = readFileSync(join(repo, ".worktree-docs/completed", completed[0]), "utf-8");
    expect(archived).toMatch(/- `[0-9a-f]{7,} feat: add feature file`/);
    expect(archived).toContain("**Completed:**");

    expect(git(repo, "log", "-1", "--pretty=%s")).toBe("docs: archive worktree doc for auth");
    expect(git(repo, "status", "--porcelain")).toBe("");
  });

  it("works with --self from inside the worktree", async () => {
    repo = createRepo({ ".gitignore": ".worktrees/\n" });
    const wt = await createWithCommit("auth");

    const { exitCode } = await runCli(join(wt, "."), ["finish", "--self", "-m", "Merge auth"]);

    expect(exitCode).toBe(0);
    expect(existsSync(wt)).toBe(false);
    expect(git(repo, "log", "--pretty=%s")).toContain("feat: add feature file");
  });

  it("stops when the worktree has uncommitted changes", async () => {
    repo = createRepo();
    const wt = await createWithCommit("auth");
    writeFileSync(join(wt, "feature.txt"), "edited\n");

    const { exitCode, output } = await runCli(repo, ["finish", "auth"]);

    expect(exitCode).toBe(1);
    expect(output).toContain("uncommitted changes");
    expect(existsSync(wt)).toBe(true);
    expect(existsSync(join(repo, "feature.txt"))).toBe(false);
  });

  it("blocks the merge when required test commands fail", async () => {
    repo = createRepo();
    setConfig({ testCommands: ["test -f feature.txt", "exit 1"], requireTestsOnFinish: true });
    git(repo, "add", ".worktreerc.json");
    git(repo, "commit", "-q", "-m", "chore: add config");
    const wt = await createWithCommit("auth");

    const { exitCode, output } = await runCli(repo, ["finish", "auth"]);

    expect(exitCode).toBe(1);
    expect(output).toContain("1 failed, 1 passed");
    expect(existsSync(wt)).toBe(true);
    expect(existsSync(join(repo, "feature.txt"))).toBe(false);
  });

  it("merges anyway when tests fail and requireTestsOnFinish is off", async () => {
    repo = createRepo({ ".gitignore": ".worktrees/\n" });
    setConfig({ testCommands: ["exit 1"], requireTestsOnFinish: false });
    git(repo, "add", ".worktreerc.json");
    git(repo, "commit", "-q", "-m", "chore: add config");
    await createWithCommit("auth");

    const { exitCode, output } = await runCli(repo, ["finish", "auth"]);

    expect(exitCode).toBe(0);
    expect(output).toContain("continuing because requireTestsOnFinish is off");
    expect(existsSync(join(repo, "feature.txt"))).toBe(true);
  });
});

describe("cwt docs path", () => {
  it("points to WORKTREE.md while active and to the archive once finished", async () => {
    repo = createRepo({ ".gitignore": ".worktrees/\n" });
    await runCli(repo, ["create", "auth"]);

    const active = await runCli(repo, ["docs", "path", "auth"]);
    expect(active.output).toBe(join(repo, ".worktrees/auth/WORKTREE.md"));

    await runCli(repo, ["finish", "auth"]);

    const completed = await runCli(repo, ["docs", "path", "auth"]);
    expect(completed.output).toMatch(/\.worktree-docs\/completed\/\d{4}-\d{2}-\d{2}-auth\.md$/);
  });
});

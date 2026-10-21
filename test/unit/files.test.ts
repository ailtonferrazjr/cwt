import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { detectPackageManager } from "../../src/lib/detect.js";
import { copyEnvFiles } from "../../src/lib/files.js";
import { makeTempDir, removeDir, writeFiles } from "../helpers.js";

describe("copyEnvFiles", () => {
  let base: string;
  afterEach(() => removeDir(join(base, "x")));

  it("copies explicit files and glob matches, creating nested dirs", async () => {
    base = makeTempDir();
    const source = join(base, "src");
    const target = join(base, "dst");
    writeFiles(source, {
      ".env": "A=1",
      "prisma/.env": "DB=x",
      ".claude/settings.json": "{}",
      ".claude/commands/start.md": "# start",
    });

    const result = await copyEnvFiles(
      source,
      target,
      [".env", "prisma/.env", ".env.local"],
      [".claude/**"]
    );

    expect(result.copied.sort()).toEqual(
      [".claude/commands/start.md", ".claude/settings.json", ".env", "prisma/.env"].sort()
    );
    expect(result.skipped).toEqual([".env.local"]);
    expect(result.failed).toEqual([]);
    expect(readFileSync(join(target, "prisma/.env"), "utf-8")).toBe("DB=x");
    expect(existsSync(join(target, ".claude/commands/start.md"))).toBe(true);
  });

  it("copies a file once when both a path and a pattern match it", async () => {
    base = makeTempDir();
    writeFiles(join(base, "src"), { ".env": "A=1" });
    const result = await copyEnvFiles(join(base, "src"), join(base, "dst"), [".env"], [".env*"]);
    expect(result.copied).toEqual([".env"]);
  });
});

describe("detectPackageManager", () => {
  let base: string;
  afterEach(() => removeDir(join(base, "x")));

  it("returns null without a lockfile", () => {
    base = makeTempDir();
    expect(detectPackageManager(base)).toBeNull();
  });

  it.each([
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["bun.lockb", "bun"],
    ["package-lock.json", "npm"],
  ])("detects %s as %s", (lockfile, manager) => {
    base = makeTempDir();
    writeFiles(base, { [lockfile]: "" });
    expect(detectPackageManager(base)).toBe(manager);
  });

  it("prefers pnpm when several lockfiles exist", () => {
    base = makeTempDir();
    writeFiles(base, { "package-lock.json": "", "pnpm-lock.yaml": "" });
    expect(detectPackageManager(base)).toBe("pnpm");
  });
});

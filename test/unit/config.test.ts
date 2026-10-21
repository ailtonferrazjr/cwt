import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getDefaultConfig,
  loadConfig,
  mergeConfig,
  resolveWorktreeDir,
} from "../../src/lib/config.js";
import { makeTempDir, removeDir } from "../helpers.js";

describe("resolveWorktreeDir", () => {
  it("replaces {name} and {repo}", () => {
    expect(resolveWorktreeDir("../{repo}-worktrees/{name}", "auth", "app")).toBe(
      "../app-worktrees/auth"
    );
  });

  it("replaces repeated placeholders", () => {
    expect(resolveWorktreeDir("{name}/{name}", "x", "app")).toBe("x/x");
  });
});

describe("mergeConfig", () => {
  it("fills missing keys with defaults", () => {
    const config = mergeConfig({ branchPrefix: "feat/", setupCommands: ["make"] });
    expect(config).toEqual({
      ...getDefaultConfig(),
      branchPrefix: "feat/",
      setupCommands: ["make"],
    });
  });

  it("keeps explicit falsy values instead of falling back", () => {
    const config = mergeConfig({ copyFiles: [], docsEnabled: false, postSetupMessage: null });
    expect(config.copyFiles).toEqual([]);
    expect(config.docsEnabled).toBe(false);
    expect(config.postSetupMessage).toBeNull();
  });
});

describe("loadConfig", () => {
  let dir: string;
  beforeEach(() => {
    dir = makeTempDir();
  });
  afterEach(() => removeDir(join(dir, "x")));

  it("returns defaults when there is no config file", async () => {
    expect(await loadConfig(dir)).toEqual(getDefaultConfig());
  });

  it("returns a fresh copy of the defaults each time", async () => {
    const first = await loadConfig(dir);
    first.copyFiles.push("mutated");
    expect((await loadConfig(dir)).copyFiles).not.toContain("mutated");
  });

  it("reads .worktreerc.json", async () => {
    writeFileSync(join(dir, ".worktreerc.json"), JSON.stringify({ worktreeDir: "wt/{name}" }));
    expect((await loadConfig(dir)).worktreeDir).toBe("wt/{name}");
  });

  it("falls back to .worktreerc", async () => {
    writeFileSync(join(dir, ".worktreerc"), JSON.stringify({ testTimeout: 1000 }));
    expect((await loadConfig(dir)).testTimeout).toBe(1000);
  });

  it("prefers .worktreerc.json over .worktreerc", async () => {
    writeFileSync(join(dir, ".worktreerc.json"), JSON.stringify({ branchPrefix: "a/" }));
    writeFileSync(join(dir, ".worktreerc"), JSON.stringify({ branchPrefix: "b/" }));
    expect((await loadConfig(dir)).branchPrefix).toBe("a/");
  });

  it("names the file when the JSON is invalid", async () => {
    writeFileSync(join(dir, ".worktreerc.json"), "{ not json");
    await expect(loadConfig(dir)).rejects.toThrow(/Invalid JSON in .*\.worktreerc\.json/);
  });
});

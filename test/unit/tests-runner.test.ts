import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runTestCommand, runTests } from "../../src/lib/tests.js";

describe("test runner", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("captures exit code and output of a shell command", async () => {
    const result = await runTestCommand("echo hello && exit 3", process.cwd(), 5000);
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(3);
    expect(result.output).toBe("hello\n");
  });

  it("kills commands that exceed the timeout", async () => {
    const result = await runTestCommand("sleep 5", process.cwd(), 100);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Command timed out after 100ms");
  });

  it("runs every command and summarizes passes and failures", async () => {
    const summary = await runTests(["true", "false", "true"], process.cwd(), 5000);
    expect(summary.success).toBe(false);
    expect(summary.passed).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.results.map((r) => r.command)).toEqual(["true", "false", "true"]);
  });
});

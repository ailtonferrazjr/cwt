import { execSync, spawn } from "node:child_process";
import chalk from "chalk";

export interface TestResult {
  success: boolean;
  command: string;
  exitCode: number;
  duration: number;
  output?: string;
  error?: string;
}

export interface TestSummary {
  success: boolean;
  results: TestResult[];
  totalDuration: number;
  passed: number;
  failed: number;
}

/**
 * Run a single test command with timeout
 */
export async function runTestCommand(
  command: string,
  cwd: string,
  timeout: number
): Promise<TestResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const [cmd, ...args] = command.split(" ");
    const child = spawn(cmd, args, {
      cwd,
      shell: true,
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGTERM");
    }, timeout);

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const duration = Date.now() - startTime;

      if (killed) {
        resolve({
          success: false,
          command,
          exitCode: -1,
          duration,
          error: `Command timed out after ${timeout}ms`,
        });
      } else {
        resolve({
          success: code === 0,
          command,
          exitCode: code ?? -1,
          duration,
          output: stdout,
          error: stderr,
        });
      }
    });
  });
}

/**
 * Run all test commands sequentially
 */
export async function runTests(
  commands: string[],
  cwd: string,
  timeout: number
): Promise<TestSummary> {
  const results: TestResult[] = [];
  const startTime = Date.now();

  for (const command of commands) {
    console.log(chalk.blue(`Running: ${command}`));
    const result = await runTestCommand(command, cwd, timeout);

    if (result.success) {
      console.log(chalk.green(`✓ ${command} (${result.duration}ms)`));
    } else {
      console.log(chalk.red(`✗ ${command} (${result.duration}ms)`));
      if (result.error) {
        console.log(chalk.dim(result.error.slice(0, 500))); // Show first 500 chars
      }
    }

    results.push(result);
  }

  const totalDuration = Date.now() - startTime;
  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return {
    success: failed === 0,
    results,
    totalDuration,
    passed,
    failed,
  };
}

/**
 * Print test summary
 */
export function printTestSummary(summary: TestSummary): void {
  console.log();
  console.log(chalk.bold("Test Summary"));
  console.log(chalk.dim("─".repeat(50)));

  if (summary.success) {
    console.log(chalk.green(`✓ All ${summary.passed} tests passed`));
  } else {
    console.log(chalk.red(`✗ ${summary.failed} failed, ${summary.passed} passed`));
    console.log();
    console.log(chalk.bold("Failed commands:"));
    summary.results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(chalk.red(`  - ${r.command}`));
        if (r.error) {
          console.log(chalk.dim(`    ${r.error.split("\n")[0]}`));
        }
      });
  }

  console.log(chalk.dim(`Total time: ${summary.totalDuration}ms`));
  console.log();
}

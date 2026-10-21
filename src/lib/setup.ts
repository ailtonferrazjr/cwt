import { spawn } from "node:child_process";

export interface SetupResult {
  success: boolean;
  command: string;
  error?: string;
}

export async function runSetupCommand(
  command: string,
  cwd: string
): Promise<SetupResult> {
  return new Promise((resolve) => {
    const proc = spawn(command, {
      cwd,
      stdio: "inherit",
      shell: true,
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true, command });
      } else {
        resolve({
          success: false,
          command,
          error: `Command exited with code ${code}`,
        });
      }
    });

    proc.on("error", (error) => {
      resolve({
        success: false,
        command,
        error: error.message,
      });
    });
  });
}

export async function runSetupCommands(
  commands: string[],
  cwd: string
): Promise<SetupResult[]> {
  const results: SetupResult[] = [];

  for (const command of commands) {
    const result = await runSetupCommand(command, cwd);
    results.push(result);

    // Stop on first failure
    if (!result.success) {
      break;
    }
  }

  return results;
}

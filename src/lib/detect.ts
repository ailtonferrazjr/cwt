import { existsSync } from "node:fs";
import { join } from "node:path";
import type { PackageManager } from "../types.js";

interface LockfileMapping {
  file: string;
  manager: PackageManager;
}

const LOCKFILES: LockfileMapping[] = [
  { file: "pnpm-lock.yaml", manager: "pnpm" },
  { file: "yarn.lock", manager: "yarn" },
  { file: "bun.lockb", manager: "bun" },
  { file: "package-lock.json", manager: "npm" },
];

export function detectPackageManager(projectDir: string): PackageManager | null {
  for (const { file, manager } of LOCKFILES) {
    if (existsSync(join(projectDir, file))) {
      return manager;
    }
  }
  return null;
}

export function getInstallCommand(manager: PackageManager): string {
  return `${manager} install`;
}

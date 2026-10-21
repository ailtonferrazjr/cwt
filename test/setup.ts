import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Isolate git from the developer's global and system config (signing,
// hooks, default branch) so the integration tests behave the same everywhere.
const home = mkdtempSync(join(tmpdir(), "cwt-gitconfig-"));
const globalConfig = join(home, ".gitconfig");
writeFileSync(
  globalConfig,
  [
    "[user]",
    "  name = cwt test",
    "  email = test@example.com",
    "[init]",
    "  defaultBranch = main",
    "[commit]",
    "  gpgsign = false",
    "",
  ].join("\n")
);

process.env.GIT_CONFIG_GLOBAL = globalConfig;
process.env.GIT_CONFIG_NOSYSTEM = "1";
process.env.CWT_NO_CLIPBOARD = "1";

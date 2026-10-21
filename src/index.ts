#!/usr/bin/env node
import { buildProgram } from "./cli.js";

buildProgram().parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

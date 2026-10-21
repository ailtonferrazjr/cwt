import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  COMMITS_PLACEHOLDER,
  DEFAULT_TEMPLATE,
  addCompletionInfo,
  createDocFromTemplate,
  findCompletedDoc,
  getTemplatePath,
  parseCompletedDocFilename,
  renderTemplate,
} from "../../src/lib/docs.js";
import { makeTempDir, removeDir } from "../helpers.js";

const date = new Date("2026-03-04T05:06:07.890Z");

describe("renderTemplate", () => {
  it("fills every placeholder occurrence", () => {
    const out = renderTemplate("{name} on {branch} at {date}. Again: {name}", {
      name: "auth",
      branch: "feature/auth",
      date,
    });
    expect(out).toBe("auth on feature/auth at 2026-03-04 05:06:07. Again: auth");
  });

  it("keeps the default template frontmatter intact", () => {
    const out = renderTemplate(DEFAULT_TEMPLATE, { name: "auth", branch: "auth", date });
    expect(out.startsWith("---\ntags: []\ndomains: []\nrelated: []\n---\n")).toBe(true);
    expect(out).toContain("# auth\n");
    expect(out).toContain("**Branch:** `auth`");
    expect(out).toContain("**Created:** 2026-03-04 05:06:07");
  });
});

describe("addCompletionInfo", () => {
  const completedAt = new Date("2026-03-10T12:00:00.000Z");

  it("fills the commits placeholder and adds a Completed line after Created", () => {
    const doc = renderTemplate(DEFAULT_TEMPLATE, { name: "auth", branch: "auth", date });
    const out = addCompletionInfo(doc, ["abc1234 feat: login", "def5678 fix: typo"], completedAt);

    expect(out).not.toContain(COMMITS_PLACEHOLDER);
    expect(out).toContain("- `abc1234 feat: login`\n- `def5678 fix: typo`");
    expect(out).toContain(
      "**Created:** 2026-03-04 05:06:07\n**Completed:** 2026-03-10 12:00:00"
    );
  });

  it("says so when there are no commits", () => {
    const doc = renderTemplate(DEFAULT_TEMPLATE, { name: "auth", branch: "auth", date });
    expect(addCompletionInfo(doc, [], completedAt)).toContain("## Commits\n\n_No commits_");
  });

  it("appends a completion section to docs without the placeholder", () => {
    const out = addCompletionInfo("# Custom doc\n", ["abc1234 feat: x"], completedAt);
    expect(out).toBe(
      "# Custom doc\n\n---\n\n**Completed:** 2026-03-10 12:00:00\n\n### Commits\n\n- `abc1234 feat: x`\n"
    );
  });
});

describe("parseCompletedDocFilename", () => {
  it("splits date and name", () => {
    expect(parseCompletedDocFilename("2026-01-15-add-search.md")).toEqual({
      name: "add-search",
      date: "2026-01-15",
    });
  });

  it("handles files without a date prefix", () => {
    expect(parseCompletedDocFilename("notes.md")).toEqual({ name: "notes" });
  });
});

describe("findCompletedDoc", () => {
  const files = [
    "2026-01-10-search.md",
    "2026-02-01-fuzzy-search.md",
    "2026-03-05-search.md",
    "README.txt",
  ];

  it("matches the exact worktree name, not a suffix", () => {
    expect(findCompletedDoc(files, "fuzzy-search")).toBe("2026-02-01-fuzzy-search.md");
  });

  it("returns the most recent doc when a name was reused", () => {
    expect(findCompletedDoc(files, "search")).toBe("2026-03-05-search.md");
  });

  it("returns undefined when nothing matches", () => {
    expect(findCompletedDoc(files, "missing")).toBeUndefined();
  });
});

describe("createDocFromTemplate", () => {
  let root: string;
  afterEach(() => removeDir(root));

  it("uses the project's custom template when one exists", async () => {
    root = join(makeTempDir(), "repo");
    const worktree = join(root, ".worktrees", "auth");
    mkdirSync(worktree, { recursive: true });

    const templatePath = getTemplatePath(root, ".docs");
    mkdirSync(join(root, ".docs", "templates"), { recursive: true });
    writeFileSync(templatePath, "# {name}\nbranch={branch}\n");

    const docPath = await createDocFromTemplate(root, ".docs", "auth", "feature/auth", worktree);

    expect(docPath).toBe(join(worktree, "WORKTREE.md"));
    expect(readFileSync(docPath, "utf-8")).toBe("# auth\nbranch=feature/auth\n");
  });
});

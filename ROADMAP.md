# Roadmap

cwt is a small tool and the plan is to keep it that way. This file tracks
what has shipped and what is being considered. Each planned item is written
so it can be copied into a GitHub issue.

## Done

- **Frontmatter in WORKTREE.md.** The default template starts with `tags`,
  `domains` and `related` fields so docs can be filtered by topic.
- **Test commands on finish.** `testCommands` run inside the worktree before
  `cwt finish` merges. With `requireTestsOnFinish` a failure blocks the merge;
  without it cwt warns and continues.
- **Test suite and CI.** Unit tests for the pure logic and integration tests
  that drive the CLI against throwaway git repos, run on every push and PR.

## Planned

### Metadata index for completed docs

`.worktree-docs/completed/` grows forever, and searching it means reading
every file. Write an `index.json` on each `cwt finish` with name, date,
frontmatter fields, a short problem summary and the commit list.

- Update the index from `archiveDoc()`
- Add `cwt docs reindex` to rebuild it after manual edits
- Backfill frontmatter for docs written before it existed

### Archiving old docs

Move completed docs older than a threshold into `archive/` so `completed/`
stays focused on recent work.

- `cwt docs archive --older-than 6m` (or a date)
- Optional `autoArchiveMonths` config applied on finish
- Keep archived docs searchable behind a flag

### Search and stats

- `cwt docs search <query>` over the index, filterable by tag and domain
- `cwt docs stats` with counts by tag and domain over a period

### Example Claude Code commands

The README describes pairing cwt with Claude Code slash commands, but none
ship with the repo. Add a few examples (start a session from WORKTREE.md,
wrap up and finish) under `examples/` that projects can copy into
`.claude/commands/`.

### Smaller items

- `--skip-tests` flag on `finish` for emergencies
- `cwt pr <name>` run from the main repo should push the worktree's branch,
  not the branch checked out where the command runs
- Windows support: worktree detection and name matching assume `/` paths
- Optional parallel execution of `testCommands`

## Open questions

- Should tags follow a fixed vocabulary, or stay free-form?
- Can domains be inferred from changed file paths?
- Should archiving keep docs that newer docs still reference?

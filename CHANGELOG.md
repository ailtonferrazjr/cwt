# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `cwt finish` runs `testCommands` inside the worktree before merging. A
  failure blocks the merge when `requireTestsOnFinish` is on and only warns
  when it is off.
- Test suite (vitest) with unit tests for the pure logic and integration
  tests that drive the CLI against temporary git repositories.
- GitHub Actions CI running typecheck, build and tests on Node 20.
- MIT license, npm package metadata, ROADMAP.md and an example WORKTREE.md
  under `examples/`.

### Fixed

- `cwt create --no-install` now skips setup commands. The flag was parsed
  but never honored.
- `cwt remove` no longer fails on every fresh worktree because of the
  untracked `WORKTREE.md`. Real uncommitted changes still block removal
  unless `--force` is passed.
- `cwt docs view` and `cwt docs path` match archived docs by exact name and
  pick the most recent one. Previously `search` could match
  `2026-01-01-fuzzy-search.md`.
- `cwt init` creates the docs structure in the configured `docsDir`.
- An invalid `.worktreerc.json` now reports the file path in the error.
- `{name}` and `{repo}` are replaced everywhere they appear in `worktreeDir`.
- The worktree path is only copied to the clipboard in an interactive
  terminal.

### Changed

- The npm package is named `@ailtonferrazjr/cwt` because `cwt` is taken. The
  command is still `cwt`.
- The CLI version is read from `package.json`.

## [1.0.0] - 2026-02-20

First version, used day to day before the public release.

### Added

- `cwt create`, `list`, `remove`, `finish`, `config` and `init` for managing
  worktrees with env file copying and setup commands.
- Per-worktree `WORKTREE.md` docs from a customizable template, archived to
  `.worktree-docs/completed/` with the branch's commits on finish.
- `cwt docs list`, `view` and `path`.
- `cwt pr` to open a GitHub PR with a body built from the doc.
- `--self` on `finish` and `pr` to detect the worktree from the current
  directory.
- YAML frontmatter (`tags`, `domains`, `related`) in the doc template.
- `testCommands`, `requireTestsOnFinish` and `testTimeout` config options
  and a test runner library.

### Fixed

- `WORKTREE.md` is untracked on the branch before merging, so finishing no
  longer conflicts on it.
- Shell injection risks in git calls, replaced with argument arrays.
- `create` refuses existing directories and branches checked out in another
  worktree.
- `finish` refuses locked worktrees and uncommitted changes.
- `remove` cleans up orphaned legacy docs and respects locked worktrees.
- `list` shows locked worktrees.

[Unreleased]: https://github.com/ailtonferrazjr/cwt/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/ailtonferrazjr/cwt/releases/tag/v1.0.0

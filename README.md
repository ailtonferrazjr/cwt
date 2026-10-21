# cwt

[![CI](https://github.com/ailtonferrazjr/cwt/actions/workflows/ci.yml/badge.svg)](https://github.com/ailtonferrazjr/cwt/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

cwt ("Claude Worktree") is a CLI for working on several branches at once with git worktrees. It handles the setup chores that make worktrees tedious, and keeps a short `WORKTREE.md` per branch that becomes your PR description and a searchable record once the work is merged.

I built it to run several Claude Code sessions in parallel, one per worktree, but nothing in it depends on Claude.

## What it does

- **Creates ready-to-run worktrees.** `cwt create` adds the worktree and branch, copies your untracked `.env` files and `.claude/` settings, and runs your install or setup commands.
- **Keeps a doc per worktree.** Each worktree gets a `WORKTREE.md` (Problem, Context, Plan, Changes, Testing, Learnings) from a template you can customize.
- **Finishes in one step.** `cwt finish` runs your test commands, merges the branch, archives the doc with its commit list into `.worktree-docs/completed/`, removes the worktree and deletes the branch.
- **Opens PRs from the doc.** `cwt pr` pushes the branch and calls `gh pr create` with a body built from the doc.
- **Knows where you are.** `--self` on `finish` and `pr` works out the worktree from your current directory.

## Install

Requires Node.js 20 or newer and git. `cwt pr` also needs the [GitHub CLI](https://cli.github.com/).

From source (works today):

```bash
git clone https://github.com/ailtonferrazjr/cwt.git
cd cwt
pnpm install
pnpm build
npm link          # puts `cwt` on your PATH
```

Once published to npm (the unscoped `cwt` name is taken, so the package is scoped):

```bash
npm install -g @ailtonferrazjr/cwt
# or run it without installing
npx @ailtonferrazjr/cwt --help
```

## Demo

A typical session in a project called `acme-api`:

```text
$ cwt init
✓ Created .worktreerc.json
✓ Added .worktrees/ to .gitignore
✓ Created .worktree-docs/ structure
✓ Created worktree documentation template

$ cwt create fix-login-redirect
Creating worktree at /code/acme-api/.worktrees/fix-login-redirect
Preparing worktree (new branch 'fix-login-redirect')
✓ Created worktree
✓ Created branch: fix-login-redirect
✓ Created doc: WORKTREE.md
✓ Copied .env

Running setup commands...
✓ pnpm install

✓ Setup complete!

cd /code/acme-api/.worktrees/fix-login-redirect (copied to clipboard)

$ cd .worktrees/fix-login-redirect
# edit code, fill in WORKTREE.md, commit as usual

$ cwt pr --self --draft
✓ Found documentation: WORKTREE.md
✓ Pushed branch: fix-login-redirect
Creating pull request...
https://github.com/acme/acme-api/pull/42
✓ Pull request created!

$ cwt finish --self
Detected worktree: fix-login-redirect
Switching to main repo: /code/acme-api

Finishing worktree: /code/acme-api/.worktrees/fix-login-redirect
Branch: fix-login-redirect

✓ Archived doc: .worktree-docs/completed/2026-10-21-fix-login-redirect.md
✓ Merged branch: fix-login-redirect
✓ Removed worktree: /code/acme-api/.worktrees/fix-login-redirect
✓ Deleted branch: fix-login-redirect
✓ Committed doc changes

✓ Finish complete!
```

`cwt init` is optional. Without a config file cwt uses the defaults listed under [Configuration](#configuration).

## Commands

| Command | What it does |
|---------|--------------|
| `cwt init [-f]` | Write `.worktreerc.json` with defaults, add `.worktrees/` to `.gitignore`, create the docs folders and template. `-f` overwrites an existing config. |
| `cwt create <name>` | Create a worktree and branch, write `WORKTREE.md`, copy env files, run setup commands. |
| `cwt list` (`ls`) | List all worktrees with branch, commit and lock state. |
| `cwt remove <name>` (`rm`) | Remove a worktree without merging. Refuses if there are uncommitted changes other than `WORKTREE.md`. |
| `cwt finish [name]` | Test, merge into the current branch, archive the doc, remove the worktree, delete the branch. |
| `cwt pr [name]` | Push the current branch and open a GitHub PR from `WORKTREE.md`. |
| `cwt docs` / `cwt docs list` | List active and completed docs. |
| `cwt docs view <name>` | Print a doc. Active docs take precedence over archived ones. |
| `cwt docs path <name>` | Print the path to a doc, handy for `$EDITOR $(cwt docs path x)`. |
| `cwt config` | Show the effective configuration for the current repo. |

`<name>` can be the worktree folder name, the branch name, or a path.

### Options

```text
cwt create <name>
  -b, --branch <branch>   Branch name (default: branchPrefix + name)
  -d, --dir <directory>   Custom worktree location
  --no-install            Skip setup commands

cwt remove <name>
  -f, --force             Remove even with uncommitted changes; with -D, force-delete the branch
  -D, --delete-branch     Also delete the branch

cwt finish [name]
  -s, --self              Use the worktree you are currently in
  -m, --message <msg>     Merge commit message
  -p, --push              Push after merging
  --no-delete-branch      Keep the branch

cwt pr [name]
  -s, --self              Use the worktree you are currently in
  -d, --draft             Open as a draft
  -w, --web               Open the PR in the browser

cwt docs list
  -a, --active            Only active docs
  -c, --completed         Only completed docs
```

Run `cwt pr` from inside the worktree. It pushes whatever branch is checked out where you run it.

## Configuration

Settings live in `.worktreerc.json` (or `.worktreerc`) at the repo root. Every key is optional.

```json
{
  "copyFiles": [".env", ".env.local", "prisma/.env"],
  "copyPatterns": [".claude/**"],
  "setupCommands": ["pnpm install", "pnpm db:generate"],
  "worktreeDir": ".worktrees/{name}",
  "branchPrefix": "feature/",
  "postSetupMessage": "Ready. Run 'pnpm dev' to start.",
  "docsEnabled": true,
  "docsDir": ".worktree-docs",
  "testCommands": ["pnpm typecheck", "pnpm test"],
  "requireTestsOnFinish": true,
  "testTimeout": 300000
}
```

| Option | Description | Default |
|--------|-------------|---------|
| `copyFiles` | Files to copy from the main repo into new worktrees. Missing files are skipped. | `.env`, `.env.local`, `.env.development`, `.env.development.local` |
| `copyPatterns` | Glob patterns to copy, dotfiles included. | `[".claude/**"]` |
| `setupCommands` | Commands run in the new worktree, in order, stopping at the first failure. | Install command for the detected package manager |
| `worktreeDir` | Where worktrees go, relative to the repo root. Supports `{name}` and `{repo}`. | `.worktrees/{name}` |
| `branchPrefix` | Prefix for new branches. | `""` |
| `postSetupMessage` | Printed after `create` finishes. | `null` |
| `docsEnabled` | Create and archive `WORKTREE.md` docs. | `true` |
| `docsDir` | Folder for the template and archived docs. | `.worktree-docs` |
| `testCommands` | Commands run inside the worktree before `finish` merges. | `[]` |
| `requireTestsOnFinish` | Block the merge when a test command fails. When off, cwt warns and continues. | `false` |
| `testTimeout` | Per-command timeout in milliseconds. | `300000` |

The package manager is detected from the lockfile: `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`, then `package-lock.json`.

`--self` relies on the worktree living under a `.worktrees/` folder, so keep that in `worktreeDir` if you use it.

## How it works

cwt is a thin layer over `git worktree`. It does not keep state of its own beyond the files below.

```text
your-repo/
├── .worktreerc.json
├── .worktrees/                  # gitignored
│   └── fix-login-redirect/      # a normal git worktree
│       └── WORKTREE.md          # untracked, lives only in the worktree
└── .worktree-docs/              # committed
    ├── templates/worktree.md    # template for new docs
    └── completed/
        └── 2026-10-21-fix-login-redirect.md
```

**create** runs `git worktree add` (with `-b` if the branch is new), renders the template into `WORKTREE.md` by filling `{name}`, `{branch}` and `{date}`, copies the configured files, and runs the setup commands in the new worktree.

**finish** does, in order:

1. Refuses if the worktree has uncommitted changes besides `WORKTREE.md`, or is locked or detached.
2. Runs `testCommands` in the worktree, if any.
3. Copies `WORKTREE.md` to `completed/YYYY-MM-DD-<name>.md` and fills in the completion time and the branch's commits (`git log <base>..<branch>`).
4. Untracks `WORKTREE.md` on the branch if it was committed, so the merge cannot conflict on it.
5. Merges the branch into whatever is checked out in the main repo.
6. Removes the worktree, prunes, deletes the branch with `git branch -d`, and commits the archived doc.
7. Pushes, if `--push` was given.

**pr** reads the Problem, Changes (or Plan, as "Approach") and Testing sections of the doc, drops HTML comments and empty sections, and passes the result to `gh pr create`. The title comes from the worktree name: `fix-login-redirect` becomes "Fix Login Redirect".

See [examples/WORKTREE.md](examples/WORKTREE.md) for a filled-in doc after `finish`.

### Using it with Claude Code

Each worktree is a separate checkout, so you can run one Claude Code session per worktree without them stepping on each other. `.claude/**` is copied by default, so local settings and custom commands follow you into every worktree.

cwt does not ship slash commands. A useful pattern is a project command that tells Claude to read `WORKTREE.md` at the start of a session and update its Changes, Testing and Learnings sections before you run `cwt finish`. The archived docs in `.worktree-docs/completed/` then give future sessions context on past work.

## Development

```bash
pnpm install
pnpm dev          # tsc in watch mode
pnpm typecheck
pnpm test         # vitest: unit tests plus integration tests against temp git repos
pnpm build
```

Integration tests create throwaway repositories in the OS temp directory and run the real CLI against them with an isolated git config.

## Contributing

Issues and pull requests are welcome. For anything bigger than a fix, open an issue first so we can agree on the approach. Please run `pnpm typecheck && pnpm test` before opening a PR, and add a test for behavior changes. Planned work is listed in [ROADMAP.md](ROADMAP.md).

## License

[MIT](LICENSE)

# cwt (Claude Worktree)

A CLI tool for managing git worktrees with automatic environment setup and documentation tracking.

## Why cwt?

Git worktrees let you work on multiple branches simultaneously without stashing or switching. cwt automates the tedious parts:

- **Environment setup** - Automatically copies `.env` files and runs install commands
- **Documentation tracking** - Creates structured docs for each worktree to capture context, decisions, and learnings
- **GitHub integration** - Generate PRs directly from worktree documentation
- **Context awareness** - Commands like `cwt finish --self` detect when you're inside a worktree

## Prerequisites

- Node.js >= 20
- Git
- A package manager (pnpm, npm, yarn, or bun)
- GitHub CLI (`gh`) for PR creation (optional)

## Installation

```bash
# Clone the repository
git clone https://github.com/ailtonferrazjr/cwt
cd cwt

# Install dependencies
pnpm install

# Build
pnpm build

# Link globally
npm link
```

After linking, `cwt` will be available globally in your terminal.

## Quick Start

```bash
# Initialize cwt in your project
cd your-project
cwt init

# Create a worktree for a feature
cwt create my-feature

# Work in the worktree
cd .worktrees/my-feature

# ... make your changes, commit them ...

# Finish: merge to main, cleanup worktree
cwt finish --self -m "feat: implement my feature"
```

## Commands

### Worktree Management

```bash
cwt init                       # Initialize project (config + docs structure)
cwt create <name>              # Create worktree with auto setup
cwt create <name> -b <branch>  # Create with specific branch name
cwt create <name> --no-install # Skip package installation
cwt list                       # List all worktrees
cwt finish <name>              # Merge and cleanup from main repo
cwt finish --self              # Merge and cleanup from within worktree
cwt finish --self -m "msg"     # With custom merge message
cwt finish <name> -p           # Finish and push to remote
cwt remove <name>              # Remove without merging
cwt remove <name> -D           # Remove and delete branch
cwt config                     # Show effective configuration
```

### Documentation

```bash
cwt docs                       # List all worktree docs
cwt docs -a                    # List active docs only
cwt docs -c                    # List completed docs only
cwt docs view <name>           # View documentation content
cwt docs path <name>           # Print path to doc file
```

### GitHub PRs

```bash
cwt pr --self                  # Create PR using worktree doc
cwt pr --self -d               # Create as draft PR
cwt pr --self -w               # Open in browser after creation
```

## Configuration

Create `.worktreerc.json` in your project root (or run `cwt init`):

```json
{
  "copyFiles": [
    ".env",
    ".env.local",
    "prisma/.env"
  ],
  "copyPatterns": [
    ".env*"
  ],
  "setupCommands": [
    "pnpm install",
    "pnpm db:generate"
  ],
  "worktreeDir": ".worktrees/{name}",
  "branchPrefix": "feature/",
  "postSetupMessage": "Ready! Run 'pnpm dev' to start.",
  "docs": {
    "enabled": true,
    "dir": ".worktree-docs"
  }
}
```

### Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `copyFiles` | Explicit files to copy | `[".env", ".env.local", ".env.development", ".env.development.local"]` |
| `copyPatterns` | Glob patterns for files | `[]` |
| `setupCommands` | Commands to run after creation | Auto-detected install command |
| `worktreeDir` | Directory pattern (`{name}` placeholder) | `.worktrees/{name}` |
| `branchPrefix` | Default branch prefix | `""` |
| `postSetupMessage` | Message shown after setup | `null` |
| `docs.enabled` | Enable documentation tracking | `true` |
| `docs.dir` | Documentation directory | `.worktree-docs` |

### Defaults Without Config

Without a config file, cwt will:
1. Copy common env files (`.env`, `.env.local`, etc.)
2. Auto-detect your package manager from lockfiles
3. Run the appropriate install command
4. Create worktrees at `.worktrees/{name}`
5. Create documentation in `.worktree-docs/`

## Documentation Structure

When docs are enabled, cwt creates:

```
.worktree-docs/
├── templates/
│   └── worktree.md       # Customizable template
├── active/
│   └── my-feature.md     # Docs for in-progress worktrees
└── completed/
    └── 2024-01-15-my-feature.md  # Archived with timestamps
```

Each doc includes sections for:
- **Problem & Context** - What you're solving and why
- **Plan** - Your approach
- **Changes** - What was modified
- **Testing** - How to verify
- **Learnings** - Insights for future reference

Completed docs include the commit history, providing rich context beyond commit messages.

## Claude Code Integration

cwt pairs well with Claude Code for AI-assisted development:

```bash
# Create worktree and start Claude
cwt create my-feature
cd .worktrees/my-feature
claude

# Use custom commands (if configured)
/cwt-start    # Load context, investigate, plan
/cwt-end      # Review, commit, update doc, finish
```

The documentation structure helps Claude understand context and track decisions across sessions.

## Development

```bash
pnpm install      # Install dependencies
pnpm dev          # Watch mode (auto-rebuild on changes)
pnpm build        # Build once
pnpm typecheck    # Type checking only
```

## License

MIT

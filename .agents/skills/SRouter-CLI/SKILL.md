---
name: srouter-cli
description: |
    Development skill for SRouter CLI (@srouter/cli / apps/cli). Use when working on CLI commands, adapters, shell environment generation, onboarding/setup flows, migrations, backup/restore logic, terminal UX, or Claude/OpenCode integrations.
---

# ⚡ SRouter — CLI Skill

Development guide for `apps/cli` (`@srouter/cli`).

## When To Read References

| Reference | Use When |
| --- | --- |
| `references/commands.md` | Adding/debugging commands or CLI flows |
| `references/adapters.md` | Working on adapters, env injection, backups |
| `references/conventions.md` | Working on Commander architecture or TS conventions |
| `references/testing.md` | Running tests and verification workflows |

## Stack

- Commander.js
- `@clack/prompts`
- TypeScript ESM
- tsup
- native `node:test`
- `tsx --test`

## Architecture

```text
src/index.ts
  ↓
commands/*
  ↓
adapters/* + lib/*
```

Main structure:

```text
apps/cli/
├── src/
│   ├── adapters/
│   ├── commands/
│   ├── lib/
│   ├── types/
│   └── index.ts
├── tests/
└── bin/srouter.js
```

## Core Rules

- `index.ts` wires commands only
- commands orchestrate flows
- adapters own tool-specific logic
- `lib/*` owns reusable helpers
- always create backups before writes
- dry-run mode must never mutate files
- keep shell exports deterministic
- avoid `any`
- use PascalCase helpers/types

## Supported Areas

Commands:

- `setup`
- `init`
- `link`
- `unlink`
- `status`
- `doctor`
- `sync`
- `env`
- `run`
- `migrate`

Adapters:

- Claude Code
- OpenCode

## Verification Gate

```bash
cd apps/cli && pnpm run build
cd apps/cli && pnpm test
```

Prefer targeted tests during iteration.

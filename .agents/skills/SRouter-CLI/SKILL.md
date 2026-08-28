---
name: srouter-cli
description: |
    Development skill for SRouter CLI (@srouter/cli / apps/cli). Use when working on CLI commands (setup, status, doctor, link, unlink, run, env), tool adapters (Claude Code, OpenCode), terminal UI (@clack/prompts, picocolors), or persistent CLI config (~/.srouter/).
---

# ⚡ SRouter — CLI Skill

Development guide for `@srouter/cli` (`apps/cli`), the terminal companion to configure and proxy AI coding tools with SRouter Gateway.

## Overview & Architecture

Built with Commander.js + `@clack/prompts` for interactive terminal workflows.

```
apps/cli/
├── bin/srouter.js           # Executable entrypoint
├── src/
│   ├── index.ts             # Commander program setup (.version(CLI_VERSION))
│   ├── adapters/            # Tool integration adapters
│   │   ├── base.ts          # AbstractToolAdapter contract
│   │   ├── claude.ts        # Claude Code integration
│   │   ├── opencode.ts      # OpenCode integration
│   │   └── index.ts         # Adapter registry
│   ├── commands/
│   │   ├── init.ts          # Bootstrap local SRouter config
│   │   ├── setup.ts         # Interactive onboarding wizard
│   │   ├── status.ts        # Health & diagnostics (alias: doctor)
│   │   ├── sync.ts          # Pull remote gateway/provider config
│   │   ├── migrate.ts       # Legacy config/database migration
│   │   ├── link.ts          # Direct tool config linking
│   │   ├── unlink.ts        # Restore original config backups
│   │   ├── run.ts           # Ephemeral process runner with proxy env
│   │   └── env.ts           # Print shell export statements
│   ├── lib/                 # Config store, platform, API utilities
│   ├── types/               # Shared CLI types
│   └── adapters/            # Tool-specific adapters
└── tests/                   # Node.js native test runner suite
```

## CLI Commands

### `srouter init`
Bootstrap local SRouter workspace and config.

Common usage:
```bash
srouter init
srouter init --force
```

Agent notes:
- Creates local config scaffolding.
- Safe first command before setup/sync flows.
- Use `--force` only when intentionally resetting config.

### `srouter setup` (`srouter config`)
Interactive onboarding wizard for connecting coding tools to SRouter Gateway.

Common usage:
```bash
srouter setup
srouter setup --url http://localhost:3000
```

Agent notes:
- Preferred command for human-guided onboarding.
- Automatically detects installed tools/adapters.
- Writes tool configs and backup snapshots.
- Use when user says “connect Claude/OpenCode to SRouter”.

### `srouter status` (`srouter doctor`)
System diagnostics and connectivity inspection.

Common usage:
```bash
srouter status
srouter doctor
```

Agent notes:
- Safe read-only command.
- Checks gateway reachability, config validity, linked adapters, and environment state.
- First troubleshooting command before modifying configs.

### `srouter sync`
Pull remote provider/model configuration from gateway.

Common usage:
```bash
srouter sync
srouter sync --provider openai
```

Agent notes:
- Use after gateway/provider changes.
- Refreshes local cache/config from server state.
- Useful when users report stale models/providers.

### `srouter migrate`
Migrate legacy SRouter configs/databases into the latest format.

Common usage:
```bash
srouter migrate
srouter migrate --input ~/.old-srouter/config.json
```

Agent notes:
- Supports legacy `.db` and JSON migration flows.
- Prefer dry inspection before destructive overwrite.
- Preserve backups before migration.

### `srouter link <tool>`
Non-interactive adapter linking.

Common usage:
```bash
srouter link claude -u http://localhost:3000 -k sk-xxx -m openai/gpt-5
srouter link opencode -u https://gateway.example.com
```

Agent notes:
- Preferred for automation/scripts.
- Always creates config backup before writing.
- Supported tools currently include Claude Code and OpenCode.

### `srouter unlink <tool>`
Restore original configs from backup.

Common usage:
```bash
srouter unlink claude
srouter unlink opencode
```

Agent notes:
- Reverts adapter modifications.
- Reads from `~/.srouter/backups/`.
- Safe rollback command during troubleshooting.

### `srouter run <tool> -- <args>`
Run a process with temporary SRouter proxy environment.

Common usage:
```bash
srouter run claude -- --dangerously-skip-permissions
srouter run opencode -- chat
```

Agent notes:
- Does not permanently modify shell environment.
- Preferred for ephemeral/proxy-only execution.
- Everything after `--` is forwarded to target tool.

### `srouter env <tool>`
Print shell export commands for manual environment setup.

Common usage:
```bash
srouter env claude
srouter env opencode
```

Agent notes:
- Returns shell-compatible `export` statements.
- Useful for CI, Docker, or manual shell injection.
- Common pattern:
```bash
eval "$(srouter env claude)"
```

## Troubleshooting Workflow

Recommended agent troubleshooting order:

1. `srouter status`
2. `srouter sync`
3. `srouter link <tool>`
4. `srouter run <tool>`
5. `srouter unlink <tool>`
6. `srouter migrate` (legacy configs only)

## Key Rules & Testing

1. **Version Constant**: Always import `CLI_VERSION` from `@srouter/constants`.
2. **Backups First**: Any mutating command (`link`, `setup`) must snapshot original configuration files before writing changes.
3. **Tests**:
    - Run tests via `cd apps/cli && pnpm test`.
    - Never run `pnpm test` across the whole monorepo directly.

## Additional Engineering Rules

### Commander Structure

- `src/index.ts` only wires commands/options.
- Business logic belongs in `commands/*`.
- Reusable filesystem/platform logic belongs in `lib/*`.
- Tool-specific integration belongs in `adapters/*`.

Keep Commander handlers thin:

```ts
.action(async (opts) => {
    await setupCommand(opts);
});
```

### Interactive UX

Use `@clack/prompts` for:

- select
- confirm
- spinner
- text input

Prefer guided flows over raw stdin prompts.

### Adapter Expectations

Current adapters:

- `claude.ts`
- `opencode.ts`

New adapters should:

1. Reuse shared adapter contracts.
2. Support backup/restore.
3. Support dry-run mode.
4. Keep tool-specific filesystem logic isolated.

### Shell Environment Consistency

`env` and `run` must stay aligned.

Supported shells:

- bash
- zsh
- fish
- powershell
- cmd

When introducing new environment variables:

1. Update all shell serializers.
2. Add/update tests.
3. Keep quoting shell-safe.

### Regression Coverage

Prioritize regression tests for:

- adapter linking
- env serialization
- migrations
- backup restore
- filesystem writes

Prefer targeted test execution during iteration:

```bash
cd apps/cli && pnpm exec tsx --test tests/claudeAdapter.test.ts
```

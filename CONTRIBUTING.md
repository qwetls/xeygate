# Contributing to XEYGATE

Thank you for your interest in contributing to **XEYGATE**! We welcome contributions from the community to help make XEYGATE the most reliable, high-performance, multi-provider AI gateway.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 22
- **pnpm** >= 11

### Setup

```bash
git clone https://github.com/XeyCompany/xeygate.git
cd xeygate
pnpm install
pnpm dev
```

### Project Structure

```
xeygate/
├── apps/
│   ├── api/          # Hono REST API server
│   ├── web/          # React dashboard SPA
│   └── cli/          # CLI tool (@xeygate/cli)
├── packages/
│   ├── constants/    # Version strings, provider catalog
│   ├── db/           # SQLite + PostgreSQL database layer
│   ├── executors/    # Provider driver classes
│   ├── pricing/      # Token pricing calculator
│   ├── providers/    # ProviderRegistry, OAuth, circuit breaker
│   ├── translator/   # OpenAI ↔ Anthropic protocol translation
│   └── types/        # Zod schemas + TypeScript types
└── docs/
```

---

## 📝 Development Guidelines

1. **Single-package changes only.** Never run `pnpm build` or `pnpm test` across the whole monorepo — test only the packages you touched.
2. **Follow existing patterns.** Check `AGENTS.md` for architecture decisions and `CODING-STYLE.md` for conventions.
3. **Type safety.** All code is TypeScript strict. Use Zod schemas for runtime validation.
4. **Commit messages.** Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`.

---

## 📄 License

By contributing to XEYGATE, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

Built by **XeyCompany Group** — [xeycompany.com](https://xeycompany.com)

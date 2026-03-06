# Playwright MCP Setup (Repository-Owned)

This repository now includes a pinned Playwright MCP server setup so AI agents can use browser automation after a restore on a new system.

## What is committed

- Root MCP config: `.mcp.json`
- Cursor MCP config: `.cursor/mcp.json`
- VS Code MCP config: `.vscode/mcp.json`
- Launcher script: `scripts/playwright-mcp.sh`
- Pinned dependency: `@playwright/mcp` in root `package.json`
- Install command: `pnpm mcp:playwright:install-browsers`

## First-time setup on a restored machine

```bash
pnpm install --frozen-lockfile
pnpm mcp:playwright:install-browsers
```

## Manual server start (stdio)

```bash
pnpm mcp:playwright
```

## Notes

- Output artifacts are written under `.playwright-cli/`.
- You can override artifact location with `PLAYWRIGHT_MCP_OUTPUT_DIR=/custom/path`.
- MCP clients should point to `pnpm mcp:playwright` for the `playwright` server.

## E2E target modes (local + public domain)

The E2E suite supports both localhost ports and public-domain execution.

- Local (default):
```bash
pnpm --filter @vexel/e2e run test:local
```

- Public domain (`https://vexel.alshifalab.pk`):
```bash
pnpm --filter @vexel/e2e run test:public
```

- Run both sequentially:
```bash
pnpm --filter @vexel/e2e run test:both
```

For operator-only LIMS smoke:

- Local:
```bash
pnpm --filter @vexel/e2e run e2e:lims
```

- Public domain:
```bash
pnpm --filter @vexel/e2e run e2e:lims:public
```

Important: keep `ADMIN_BASE` as root domain (`https://vexel.alshifalab.pk`), not `/admin`, because tests navigate to `/admin/...` routes directly.

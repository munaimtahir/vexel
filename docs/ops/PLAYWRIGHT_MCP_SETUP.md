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

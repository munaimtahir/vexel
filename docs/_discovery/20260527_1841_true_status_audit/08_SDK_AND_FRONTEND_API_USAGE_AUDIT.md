# 08_SDK_AND_FRONTEND_API_USAGE_AUDIT.md

**Audit Status:** **PASS (Enforced via ESLint)**

---

This document verifies compliance with frontend-to-backend communication rules, specifically checking for direct API calls bypassing the client SDK.

## 1. Automated Guardrails (ESLint)

Both frontend Next.js applications (`apps/admin` and `apps/operator`) configure ESLint rules (`.eslintrc.json`) to prohibit the usage of raw `fetch()` calls.

### File: `apps/admin/.eslintrc.json` & `apps/operator/.eslintrc.json`
```json
{
  "rules": {
    "no-restricted-globals": [
      "error",
      {
        "name": "fetch",
        "message": "Use @vexel/sdk API client instead of raw fetch(). See lib/api-client.ts"
      }
    ]
  }
}
```
This rule causes any development build or lint check to fail if a developer attempts to call `window.fetch()` directly in frontend code.

---

## 2. Static Scans for Ad-hoc APIs

### Scan for Axios Imports:
A recursive search for `axios` imports in `apps/admin` and `apps/operator` yielded **zero results** in active codebase files. The only mentions are explanatory warnings in API client comments:
- `apps/admin/src/lib/api-client.ts`
- `apps/operator/src/lib/api-client.ts`

### Scan for Raw Fetch Calls:
A search for `fetch(` calls in source directories returned **zero violations**. The only occurrences are inside the ESLint configuration rules themselves.

---

## 3. Verdict

The system enforces strict compliance with the **No Ad-hoc Frontend API calls** rule. The guardrails are structurally locked in the build process via ESLint, preventing developer regressions. All API traffic goes through the generated `@vexel/sdk` client wrapper.

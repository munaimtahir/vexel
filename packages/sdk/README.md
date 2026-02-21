# @vexel/sdk

Generated TypeScript client for the Vexel Health API.

## Regenerate

From repo root:
```
pnpm sdk:generate
```

## Usage

```ts
import { createApiClient } from '@vexel/sdk';

const api = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL!,
  token: accessToken,
});

const { data, error } = await api.GET('/health');
```

## Rules
- **NEVER** import axios or fetch directly in Next.js apps.
- **ALWAYS** use this SDK to call the API.
- If a new endpoint exists in openapi.yaml but not in this SDK, run `pnpm sdk:generate`.

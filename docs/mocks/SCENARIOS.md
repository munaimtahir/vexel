# Mock Scenarios

Set the `x-mock-scenario` header (or `NEXT_PUBLIC_MOCK_SCENARIO` env var) to select a scenario.

| Scenario Name | x-mock-scenario value | Simulates | Fixture File |
|---|---|---|---|
| Login success | `auth.login.ok` | Successful login | auth/login.ok.json |
| Login invalid credentials | `auth.login.401` | Wrong password | auth/login.401.json |
| Login account disabled | `auth.login.403` | Disabled account | auth/login.403.json |
| Encounter list | `encounters.list.ok` | List with one encounter | encounters/list.ok.json |
| Encounter detail | `encounters.get.ok` | Single encounter detail | encounters/get.ok.json |
| Create encounter | `encounters.create.ok` | New encounter created | encounters/create.ok.json |
| Invalid workflow transition | `encounters.command.transition_409` | 409 wrong step | encounters/command.transition_409.json |
| Patient list | `patients.list.ok` | Two patients | patients/list.ok.json |
| Create patient | `patients.create.ok` | New patient | patients/create.ok.json |
| Create patient validation error | `patients.create.422` | 422 validation | patients/create.422.json |
| Catalog tests | `catalog.tests.ok` | Two tests | catalog/tests.ok.json |
| Catalog parameters | `catalog.parameters.ok` | Two parameters | catalog/parameters.ok.json |
| Documents list | `documents.list.ok` | Receipt published | documents/list.ok.json |
| Document rendered | `documents.get.rendered` | Report rendering | documents/get.rendered.json |
| Document published | `documents.get.published` | Report published | documents/get.published.json |
| Document download forbidden | `documents.download.403` | No permission | documents/download.403.json |
| Document generate not found | `documents.generate.404` | Encounter missing | documents/generate.404.json |

## How to trigger a scenario

### Via env var (applies to all requests):
```
NEXT_PUBLIC_MOCK_SCENARIO=encounters.command.transition_409 pnpm dev:ui-mock
```

### Via SDK client header injection:
The SDK client reads `process.env.NEXT_PUBLIC_MOCK_SCENARIO` and injects `x-mock-scenario` header automatically when set.

### Via curl:
```bash
curl http://localhost:9031/api/encounters -H "x-mock-scenario: encounters.list.ok"
```

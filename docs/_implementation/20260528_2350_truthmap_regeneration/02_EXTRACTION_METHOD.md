# Extraction Method

## Methodology
The truthmap was generated using a three-stage automated pipeline:

### 1. OpenAPI Extraction (`extract_openapi.py`)
- Parses `packages/contracts/openapi.yaml` using PyYAML.
- Extracts `path`, `method`, `operationId`, `summary`, and `tags`.
- Provides the canonical "Contract Truth".

### 2. Frontend Scan (`extract_frontend.py`)
- Recursively scans `apps/admin/src` and `apps/operator/src`.
- Uses regular expressions to identify calls to the SDK: `api.(GET|POST|PUT|PATCH|DELETE)`.
- Normalizes path parameters: `${id}` -> `{param}`.
- Tracks the `file` and `app` for each call.

### 3. Backend Scan (`extract_backend.py`)
- Recursively scans `apps/api/src`.
- Identifies NestJS controllers using `@Controller`.
- Maps HTTP decorators (`@Get`, `@Post`, etc.) to full paths.
- Extracts permissions from `@RequirePermissions`.
- Infers service names from controller names.

### 4. Normalization and Join (`generate_final_truthmap.py`)
- Merges the three datasets based on `(method, normalized_path)`.
- Resolves `openapiOperationId` and `permission` for each frontend action.
- Classifies each entry based on tags and path patterns (e.g., `/opd/` -> `FUTURE_NON_MVP`).
- Generates JSON and CSV artifacts.

# Vexel Health Platform — Project Context & Mandates

## Project Overview
Vexel is a futuristic, multi-tenant healthcare management system built with a modular, contract-first architecture. While the Laboratory Information Management System (LIMS) is the first module, the platform is designed to support RIMS, OPD, and other healthcare modules without refactoring.

## ⚖️ The Law: Non-Negotiable Guardrails
Every contributor (AI or Human) must adhere to these structural mandates:

1.  **Contract-First OpenAPI:** `packages/contracts/openapi.yaml` is the single source of truth.
2.  **Generated SDK Only:** Frontends (Admin/Operator) must **ONLY** use the generated `@vexel/sdk`. Direct `fetch` or `axios` calls to the API are strictly prohibited.
3.  **No Direct DB Access from Frontend:** Next.js apps are API clients only. Prisma imports in `apps/admin` or `apps/operator` are prohibited.
4.  **Strict Tenant Isolation:** Every customer-owned entity must have a `tenantId`. All queries and uniqueness constraints must be tenant-scoped.
5.  **Command-Only State Changes:** Workflow state transitions (status, stage, verification) must happen via dedicated Command endpoints (e.g., `POST /encounters/{id}:lab-verify`), never via direct CRUD updates.
6.  **Deterministic Documents:** Documents are identified by a hash of their canonical payload. Publishing is idempotent and retry-safe.
7.  **Backend-Authoritative Feature Flags:** The frontend never decides feature availability; it reads resolved, tenant-scoped flags from the backend.
8.  **Auditability:** Every workflow command and administrative change must write an `AuditEvent` and include a `correlationId`.

## 🏗️ Architecture & Tech Stack

### Components
-   **API (NestJS):** The core business logic and OpenAPI server.
-   **Worker (BullMQ):** Handles async tasks like PDF rendering, imports, and scheduled jobs.
-   **PDF Service (.NET + QuestPDF):** Dedicated high-performance PDF generation.
-   **Operator UI (Next.js):** The primary workflow interface for LIMS/healthcare operations.
-   **Admin UI (Next.js):** Back-office configuration and observability tool.
-   **Infrastructure:** PostgreSQL, Redis, MinIO (S3 storage), Caddy (Reverse Proxy).

### Monorepo Structure
-   `apps/api`: NestJS Backend.
-   `apps/admin`: Next.js Admin App (basePath: `/admin`).
-   `apps/operator`: Next.js Operator App.
-   `apps/pdf`: .NET PDF generation service.
-   `apps/worker`: BullMQ worker process.
-   `packages/contracts`: OpenAPI specification and SDK generation scripts.
-   `packages/sdk`: Generated TypeScript API client.
-   `packages/theme` / `packages/ui-system`: Shared UI components and styling.
-   `docs/`: Extensive documentation on specs, architecture, and operations.

## 🚀 Key Commands

### Development
-   `pnpm install`: Install dependencies (use `--frozen-lockfile` in CI).
-   `pnpm dev`: Start all services in development mode via Turborepo.
-   `pnpm dev:ui-mock`: Run frontends against a Prism mock gateway (useful for UI-first development).
-   `pnpm sdk:generate`: Regenerate the SDK after changes to `openapi.yaml`.
-   `pnpm dev:full`: Bring up the entire stack using Docker Compose.

### Build & Test
-   `pnpm build`: Build all applications and packages.
-   `pnpm lint`: Run linting across the monorepo.
-   `pnpm mcp:playwright:install-browsers`: Setup Playwright for E2E testing.
-   `pnpm test`: Run unit/integration tests (primarily in `apps/api`).

## 🛠️ Development Workflow
1.  **Feature/Workflow Lock:** Define the scope and state machine in `docs/specs/`.
2.  **OpenAPI Lock:** Update `openapi.yaml` and run `pnpm sdk:generate`.
3.  **Frontend (Mock Mode):** Build UI using the generated SDK against the mock gateway (`:9031`).
4.  **Backend Implementation:** Implement the contract exactly in the NestJS API.
5.  **Verification:** Run smoke tests and E2E suites to confirm full-stack integrity.

## 📝 Directory Navigation
-   **Specs:** `docs/specs/` (LIMS workflows, Tenancy, Architecture).
-   **Ops:** `docs/ops/` (Smoke tests, Backup/Restore).
-   **Prompts:** `docs/prompts/` (Contextual instructions for different agent roles).
-   **Database:** `apps/api/prisma/schema.prisma`.
-   **API Contract:** `packages/contracts/openapi.yaml`.

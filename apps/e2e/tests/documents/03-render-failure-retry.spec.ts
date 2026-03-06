/**
 * tests/documents/03-render-failure-retry.spec.ts
 * @documents — PDF render failure simulation.
 *
 * These tests require infrastructure-level injection (bad PDF_SERVICE_URL)
 * which is not available in the standard test environment.
 * Skipped with explanation.
 */

import { test } from '@playwright/test';

test.describe('@documents Documents — Render Failure & Retry', () => {
  test.skip(
    true,
    `
    Render failure simulation requires injecting PDF_SERVICE_URL=http://invalid-host:9999
    at the Docker container level so the PDF worker fails to render.

    To enable this test:
    1. Stop the pdf service container
    2. Update docker-compose.yml: PDF_SERVICE_URL=http://invalid-host:9999 in the api/worker env
    3. Trigger document generation
    4. Verify document status reaches FAILED
    5. Restart pdf service and verify FAILED → retried → RENDERED

    Once infrastructure hooks are wired, re-enable this test and implement:
      - Trigger verification (creates QUEUED document)
      - Poll until document reaches FAILED status
      - Restart PDF service via API or infrastructure hook
      - Re-queue document (POST /documents/{id}:retry if implemented)
      - Poll until document reaches RENDERED or PUBLISHED
    `,
  );

  test('PDF render failure results in FAILED document status', async () => {
    // Infrastructure: inject PDF_SERVICE_URL=http://invalid-host:9999
    // Then verify via API: GET /documents/{id} → { status: 'FAILED' }
  });

  test('Retry on FAILED document re-queues and eventually renders', async () => {
    // Infrastructure: restore PDF_SERVICE_URL to real value
    // POST /documents/{id}:retry
    // Poll until status = RENDERED or PUBLISHED
  });
});

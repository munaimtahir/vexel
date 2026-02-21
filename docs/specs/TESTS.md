# Tests (Minimum Bar)

## Unit tests
- API: state machine transition validation tests
- Documents: hash + idempotency tests

## Integration tests
- Tenancy isolation (Tenant A cannot read Tenant B)
- Publish is idempotent

## E2E smoke tests
- docs/ops/SMOKE_TESTS.md must pass after each slice.

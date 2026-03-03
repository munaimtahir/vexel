#!/usr/bin/env bash
# =============================================================================
# backup_tenant.sh — Vexel Tenant-Specific Export
# Exports all rows for a single tenantId from every tenant-scoped table.
# Output: /home/munaim/srv/apps/vexel/runtime/backups/tenants/vexel-tenant-<ID>-YYYYMMDD_HHMMSS.tar.gz
#
# Usage: ./backup_tenant.sh <tenantId>
# Example: ./backup_tenant.sh demo-lab-01
#
# Schema guarantee: ALL tenant-scoped tables have a "tenantId" column with FK to tenants.
# Tables WITHOUT tenantId (system-level): _prisma_migrations, refresh_tokens,
#   role_permissions, user_roles, worker_heartbeats
# These are NOT exported here (they are global/system data).
#
# TODO (future hardening):
#   - MinIO objects: filter by prefix "tenants/<tenantId>/" when bucket is prefixed by tenant
#   - Audit referential integrity before restore (FK chains across tables)
#   - PII redaction option for test/staging exports
# =============================================================================
set -euo pipefail

TENANT_ID="${1:-}"
if [ -z "$TENANT_ID" ]; then
  echo "Usage: $0 <tenantId>" >&2
  exit 1
fi

VEXEL_ROOT="/home/munaim/srv/apps/vexel"
LOG_DIR="$VEXEL_ROOT/runtime/data/logs"
BACKUP_DIR="$VEXEL_ROOT/runtime/backups/tenants"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
SAFE_ID="${TENANT_ID//[^a-zA-Z0-9_-]/_}"
PKG_NAME="vexel-tenant-${SAFE_ID}-${TIMESTAMP}"
WORK_DIR="/tmp/${PKG_NAME}"

mkdir -p "$LOG_DIR" "$BACKUP_DIR"
LOG_FILE="$LOG_DIR/backup_tenant_${SAFE_ID}_${TIMESTAMP}.log"

exec > >(tee -a "$LOG_FILE") 2>&1
echo "[$(date -Iseconds)] ===== Vexel Tenant Backup START — tenantId=${TENANT_ID} ====="

cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

error_exit() {
  echo "[$(date -Iseconds)] ERROR: $1" >&2
  exit 1
}

# Verify tenant exists to prevent empty/ghost exports
TENANT_CHECK=$(docker exec vexel-postgres-1 psql -U vexel -tAc \
  "SELECT id FROM tenants WHERE id = '${TENANT_ID}' LIMIT 1;" 2>/dev/null)
if [ -z "$TENANT_CHECK" ]; then
  error_exit "Tenant '${TENANT_ID}' not found in database. Aborting to prevent empty export."
fi
echo "[$(date -Iseconds)] Tenant verified: ${TENANT_ID}"

mkdir -p "$WORK_DIR/data"

# All tables with tenantId FK — export each as SQL COPY text format
TENANT_TABLES=(
  appointments
  audit_events
  cash_transactions
  catalog_panels
  catalog_tests
  document_templates
  documents
  encounters
  invoice_lines
  invoices
  job_runs
  lab_orders
  lab_results
  opd_clinical_notes
  opd_prescription_items
  opd_prescriptions
  opd_visits
  opd_vitals
  panel_test_mappings
  parameters
  patients
  payments
  provider_schedules
  providers
  reference_ranges
  roles
  sample_types
  specimen_items
  specimens
  tenant_configs
  tenant_domains
  tenant_features
  tenant_top_tests
  test_parameter_mappings
  users
)

# Also export the tenant row itself
echo "[$(date -Iseconds)] Exporting tenant metadata..."
docker exec vexel-postgres-1 psql -U vexel -c \
  "\\COPY (SELECT * FROM tenants WHERE id = '${TENANT_ID}') TO STDOUT WITH (FORMAT CSV, HEADER)" \
  > "$WORK_DIR/data/tenants.csv" 2>&1 \
  || error_exit "Failed to export tenants table"

ROW_COUNTS=()
for TABLE in "${TENANT_TABLES[@]}"; do
  echo "[$(date -Iseconds)] Exporting table: ${TABLE}..."
  docker exec vexel-postgres-1 psql -U vexel -c \
    "\\COPY (SELECT * FROM ${TABLE} WHERE \"tenantId\" = '${TENANT_ID}') TO STDOUT WITH (FORMAT CSV, HEADER)" \
    > "$WORK_DIR/data/${TABLE}.csv" 2>&1 \
    || error_exit "Failed to export table: ${TABLE}"

  ROWS=$(wc -l < "$WORK_DIR/data/${TABLE}.csv")
  ROWS=$((ROWS - 1))  # subtract header
  if [ "$ROWS" -lt 0 ]; then ROWS=0; fi
  ROW_COUNTS+=("\"${TABLE}\": ${ROWS}")
  echo "[$(date -Iseconds)]   -> ${ROWS} rows"
done

# Manifest
ROW_COUNTS_JSON=$(printf '%s\n' "${ROW_COUNTS[@]}" | paste -sd ',' -)
cat > "$WORK_DIR/manifest.json" <<EOF
{
  "backup_type": "tenant",
  "tenant_id": "${TENANT_ID}",
  "timestamp": "$(date -Iseconds)",
  "hostname": "$(hostname)",
  "format": "csv_per_table",
  "row_counts": { ${ROW_COUNTS_JSON} },
  "notes": "Export contains only rows where tenantId='${TENANT_ID}'. System tables (migrations, refresh_tokens, role_permissions, user_roles, worker_heartbeats) excluded — they are global."
}
EOF

# Package
echo "[$(date -Iseconds)] Creating archive..."
tar czf "$BACKUP_DIR/${PKG_NAME}.tar.gz" -C /tmp "$PKG_NAME"
FINAL_SIZE=$(du -sh "$BACKUP_DIR/${PKG_NAME}.tar.gz" | cut -f1)

echo "[$(date -Iseconds)] ===== Tenant Backup COMPLETE ====="
echo "[$(date -Iseconds)] Package : $BACKUP_DIR/${PKG_NAME}.tar.gz"
echo "[$(date -Iseconds)] Size    : $FINAL_SIZE"
echo "[$(date -Iseconds)] Log     : $LOG_FILE"

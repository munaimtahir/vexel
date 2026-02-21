# Backup Posture (MVP)

## MVP rule
- Daily Postgres dump + retention (7 daily, 4 weekly, 12 monthly)
- Document storage backup (LOCAL folder) aligned with DB backup

## Why
- “Destruction-proof” posture is required from day one.

## Later
- Move documents to S3/MinIO and rely on object storage lifecycle policies.

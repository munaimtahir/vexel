# Runtime Health

Commands:
- `docker compose up -d --no-build`
- `docker compose ps`
- `curl -fsS http://127.0.0.1:9021/api/health`
- `curl -fsS http://127.0.0.1:9022/health/pdf`
- `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:9023/admin/login`
- `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:9024/lims/worklist`

Results snapshot:
- API: healthy (`200`, JSON status ok)
- PDF: healthy (`200`, JSON status ok)
- Admin login page: `200`
- Operator /lims/worklist: `307` (expected redirect when unauthenticated)
- Postgres/Redis/MinIO/API/PDF healthy in compose status
- Worker container up

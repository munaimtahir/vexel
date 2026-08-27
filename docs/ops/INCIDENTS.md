# Incident Log

## 2026-08-27 — `vexel.alshifalab.pk` unreachable in production Caddy (resolved)

**Detected:** during the build-readiness sprint's live-verification pass
(§6b of `SPRINT_HANDOFF.md`), before any Caddy-related work was planned for
that session — this was an unrelated, pre-existing outage discovered while
smoke-testing `https://vexel.alshifalab.pk/api/health`.

**Symptom:** `curl https://vexel.alshifalab.pk/...` failed the TLS
handshake with `tlsv1 alert internal error` (Caddy's generic response when
no site block matches the connecting SNI). All internal, loopback-bound
checks (`127.0.0.1:9021/api/health`, `docker compose ps`) were healthy —
this was purely a public-ingress routing problem, not an application
outage.

**Root cause:** `/etc/caddy/Caddyfile` had **no `vexel.alshifalab.pk` site
block, and no `import overrides/*.Caddyfile` line** — the `/etc/caddy/overrides/`
directory referenced in this repo's own `runtime/proxy/vexel.Caddyfile`
header comment didn't exist on disk at all. Confirmed via Caddy's read-only
admin API (`GET localhost:2019/config/apps/http/servers`) that the *running*
config genuinely had zero routes for the host — this wasn't a caching or
DNS issue.

A backup snapshot from the day before,
`/etc/caddy/Caddyfile.bak.2026-08-21_204954`, still contained a full inline
`vexel.alshifalab.pk { ... }` block. The current file at the time
(`/etc/caddy/Caddyfile`, last modified 2026-08-22 21:13, matching backup
`Caddyfile.bak.2026-08-22_211340`) did not. Something — almost certainly an
unrelated Caddyfile edit made for one of the other ~20 products sharing this
Caddy instance (PlayGrowth Copilot, MedPrep, EasyUI, radreport, bill, qcall,
pgsims, fmu-platform, etc.) — dropped Vexel's block entirely, with no
overrides-import mechanism in place to fall back on. This repo's own
`runtime/proxy/vexel.Caddyfile` was accurate and never touched; it was just
never wired into the live file.

**Blast radius:** Vexel's public domain only. All other ~20 hosts on this
shared Caddy instance were confirmed present and unaffected in the routing
table both before and after the fix (`localhost:2019/config/...`
read-only query). Internal Vexel services were never affected — this was a
public-DNS/TLS-routing gap only, not a data or application issue.

**Fix applied (with explicit human confirmation before the reload, per this
repo's standing Caddy-safety rule):**
1. `sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.<timestamp>_pre-vexel-restore`
   — safety backup before any edit.
2. Appended the same `vexel.alshifalab.pk { ... }` block already documented
   in `runtime/proxy/vexel.Caddyfile` (routes: `/api/*` → API :9021,
   `/pdf/*` → PDF :9022, `/admin`(`/*`) → Admin :9023, `/vexel-documents/*`
   → MinIO :9027, everything else → Operator :9024) directly to the end of
   `/etc/caddy/Caddyfile`, using the file's existing `std_headers` /
   `std_log` / `std_proxy` snippets — same pattern every other site in that
   file already uses. Did not introduce the `overrides/*.Caddyfile` import
   mechanism the repo comment describes, since it doesn't exist live and
   reconstructing it was out of scope for an urgent routing restore; every
   other site in `/etc/caddy/Caddyfile` is inline in the same way, so this
   keeps the fix consistent with the file's actual current structure. (Re-
   introducing a maintained `overrides/` import convention, if wanted, is a
   separate follow-up — see `SPRINT_HANDOFF.md` §6a.)
3. Validated with `caddy adapt --config /etc/caddy/Caddyfile` (read-only) —
   confirmed clean adapt, `vexel.alshifalab.pk` correctly present in the
   adapted JSON, no new syntax errors (only a pre-existing, unrelated
   `caddy fmt` formatting warning on line 2).
4. **Explicit human confirmation obtained in-session before reloading.**
   Ran `sudo caddy reload --config /etc/caddy/Caddyfile`. Reload completed
   with no errors.
5. Verified: `https://vexel.alshifalab.pk/api/health` → `200` (3/3
   consecutive attempts). Spot-checked `play.vexel.pk` (502 — its own
   upstream app being down, confirmed pre-existing and unrelated via
   `journalctl -u caddy` before the reload) and `easyui.vexel.pk` (404 on
   `/`, expected — no handler for bare root) to confirm no collateral
   damage. Confirmed via the admin API that host-matched routes went from
   20 to 24 (the four Vexel handle blocks under one host match), and no new
   errors/panics in `journalctl -u caddy` since the reload.

**Rollback path (not needed, but documented):** restore
`/etc/caddy/Caddyfile.bak.<timestamp>_pre-vexel-restore` over
`/etc/caddy/Caddyfile` and `sudo caddy reload --config /etc/caddy/Caddyfile`.

**Follow-up recommended (not yet done):** decide whether to formalize the
`overrides/*.Caddyfile` import pattern this repo's own comments assume
exists, so a future edit to the shared Caddyfile for an unrelated product
can't silently drop Vexel's block again with no fallback. Tracked under
`SPRINT_HANDOFF.md` §6a (production tenant ingress).

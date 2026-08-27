# Uptime Monitoring

## Mechanism

`ops/monitoring/health-check.sh` runs on a 5-minute cron
(`*/5 * * * * /home/munaim/srv/apps/vexel/ops/monitoring/health-check.sh`,
installed in the host's crontab — check with `crontab -l`). Each run:

1. Hits the **internal** API health endpoint
   (`http://127.0.0.1:9021/api/health`, bypassing Caddy entirely).
2. Hits the **public** HTTPS endpoint
   (`https://vexel.alshifalab.pk/api/health`, through Caddy/TLS/DNS).
3. For each of the two, compares the result (`up`/`down`) against the last
   known state (`runtime/health-check.state` for internal,
   `runtime/health-check.public.state` for public) and appends a line to
   `runtime/health-check.log` only when the state actually changes —
   so the log stays a signal of real transitions, not 5-minute noise.

Log line format: `<ISO8601 UTC> state_change target=<internal|public> prev=<state> new=<state>`.

## Why both checks exist

The internal-only check existed first (added 2026-07-24, after the stack
had been down ~7 weeks with nothing watching it). The public check was
added 2026-08-27 after a real incident where the internal check stayed
`up` continuously for ~5 days while `vexel.alshifalab.pk` was completely
unreachable from the public internet — a Caddy routing gap unrelated to
the application (see `docs/ops/INCIDENTS.md`, 2026-08-27 entry: the shared
host's `/etc/caddy/Caddyfile` silently lost its Vexel site block). An
internal-only check structurally cannot catch that class of outage, since
it never goes through Caddy/DNS/TLS at all.

## Checking status

```bash
tail -50 runtime/health-check.log          # recent state transitions
cat runtime/health-check.state             # current internal state
cat runtime/health-check.public.state      # current public state
```

## Relationship to `ops/healthcheck.sh`

`ops/healthcheck.sh` is a separate, more thorough, manually-run script (19
checks: every container by name, every internal port, all three public
routes, and a Caddy config validate) — used for on-demand deep verification
(e.g. after a deploy, or per the resume/verification steps in
`SPRINT_HANDOFF.md`), not scheduled. Run it directly: `bash ops/healthcheck.sh`.

## Known limitation / follow-up

Neither script currently pages or notifies anyone — they only log to a
local file. If an actual external alert (email/Slack/SMS on state change)
is wanted, that's a follow-up, not yet implemented. The log-based approach
at least makes the history inspectable and auditable after the fact, which
is what caught the lack-of-public-check gap during this sprint's audit.

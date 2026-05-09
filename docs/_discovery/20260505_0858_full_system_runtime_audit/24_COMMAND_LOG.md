# 24_COMMAND_LOG.md

_Status: Draft (auto-generated)


## 2026-05-05T08:58:41Z

```bash
pwd
```

Output: `docs/_discovery/20260505_0858_full_system_runtime_audit/logs/00_pwd.txt`


## 2026-05-05T08:58:41Z

```bash
ls -la
```

Output: `docs/_discovery/20260505_0858_full_system_runtime_audit/logs/01_ls.txt`


## 2026-05-05T08:58:41Z

```bash
git status --short
```

Output: `docs/_discovery/20260505_0858_full_system_runtime_audit/logs/02_git_status.txt`


## 2026-05-05T08:58:41Z

```bash
git branch --show-current
```

Output: `docs/_discovery/20260505_0858_full_system_runtime_audit/logs/03_git_branch.txt`


## 2026-05-05T08:58:41Z

```bash
git rev-parse HEAD
```

Output: `docs/_discovery/20260505_0858_full_system_runtime_audit/logs/04_git_head.txt`


## 2026-05-05T08:58:41Z

```bash
find . -maxdepth 3 -type f | sort | sed 's#^\./##' | head -300
```

Output: `docs/_discovery/20260505_0858_full_system_runtime_audit/logs/05_find_files_head.txt`


## 2026-05-05T08:58:42Z

```bash
find . -maxdepth 3 -type d | sort | sed 's#^\./##'
```

Output: `docs/_discovery/20260505_0858_full_system_runtime_audit/logs/06_find_dirs.txt`


## 2026-05-05T08:58:42Z

```bash
find . -maxdepth 3 \( -iname '*compose*' -o -iname 'Dockerfile' -o -iname '.env.example' -o -iname 'package.json' -o -iname 'pnpm-lock.yaml' -o -iname 'yarn.lock' -o -iname 'package-lock.json' \) | sort | sed 's#^\./##'
```

Output: `docs/_discovery/20260505_0858_full_system_runtime_audit/logs/07_find_key_files.txt`


## 2026-05-05T08:58:42Z

```bash
node -v || true
```

Output: `docs/_discovery/20260505_0858_full_system_runtime_audit/logs/08_node.txt`


## 2026-05-05T08:58:42Z

```bash
pnpm -v || true
```

Output: `docs/_discovery/20260505_0858_full_system_runtime_audit/logs/09_pnpm.txt`


## 2026-05-05T08:58:46Z

```bash
npm -v || true
```

Output: `docs/_discovery/20260505_0858_full_system_runtime_audit/logs/10_npm.txt`


## 2026-05-05T08:58:47Z

```bash
yarn -v || true
```

Output: `docs/_discovery/20260505_0858_full_system_runtime_audit/logs/11_yarn.txt`


## 2026-05-05T08:58:47Z

```bash
dotnet --version || true
```

Output: `docs/_discovery/20260505_0858_full_system_runtime_audit/logs/12_dotnet.txt`


## 2026-05-05T08:58:47Z

```bash
docker --version || true
```

Output: `docs/_discovery/20260505_0858_full_system_runtime_audit/logs/13_docker.txt`


## 2026-05-05T08:58:48Z

```bash
docker compose version || true
```

Output: `docs/_discovery/20260505_0858_full_system_runtime_audit/logs/14_docker_compose.txt`


## 2026-05-05T08:58:49Z

```bash
ls -la docker-compose* compose* *.yml *.yaml 2>/dev/null || true
```

Output: `docs/_discovery/20260505_0858_full_system_runtime_audit/logs/15_docker_compose_ls.txt`


## 2026-05-05T08:58:49Z

```bash
find . -maxdepth 4 -name '.env.example' -o -name '.env.*.example' -o -name '.env.sample' -o -name '.env.template' | sort | sed 's#^\./##'
```

Output: `docs/_discovery/20260505_0858_full_system_runtime_audit/logs/16_env_examples.txt`


## 2026-05-05T08:58:52Z

```bash
docker image ls --format '{{.Repository}}:{{.Tag}}' | rg -i 'postgres|redis' || true
```

Output: `docs/_discovery/20260505_0858_full_system_runtime_audit/logs/17_pg_redis_images.txt`


## 2026-05-05T08:58:54Z

```bash
git diff --stat || true
```

Output: `docs/_discovery/20260505_0858_full_system_runtime_audit/logs/18_git_diff.txt`


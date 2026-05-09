# 24_COMMAND_LOG.md

All commands executed in UTC on 2026-05-05.
Each command's full stdout/stderr is saved under `logs/`.

## 00_pwd

`pwd`

Output: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/00_pwd.txt`

## 01_git_status

`git status --short`

Output: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/01_git_status.txt`

## 02_git_branch

`git branch --show-current`

Output: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/02_git_branch.txt`

## 03_git_head

`git rev-parse HEAD`

Output: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/03_git_head.txt`

## 04_git_remote

`git remote -v`

Output: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/04_git_remote.txt`

## 05_ls

`ls -la`

Output: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/05_ls.txt`

## 06_find_files

`find . -maxdepth 3 -type f | sort | sed 's#^\./##' | head -300`

Output: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/06_find_files.txt`

## 07_find_dirs

`find . -maxdepth 3 -type d | sort | sed 's#^\./##'`

Output: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/07_find_dirs.txt`

## 08_find_key_files

`find . -maxdepth 3 \( -iname '*compose*' -o -iname 'Dockerfile' -o -iname '.env.example' -o -iname 'package.json' -o -iname 'pnpm-lock.yaml' -o -iname 'yarn.lock' -o -iname 'package-lock.json' \) | sort | sed 's#^\./##'`

Output: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/08_find_key_files.txt`

## 09_node

`node -v`

Output: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/09_node.txt`

## 10_pnpm

`pnpm -v`

Output: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/10_pnpm.txt`

## 11_npm

`npm -v`

Output: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/11_npm.txt`

## 12_dotnet

`dotnet --version`

Output: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/12_dotnet.txt`

## 13_docker

`docker --version`

Output: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/13_docker.txt`

## 14_docker_compose

`docker compose version`

Output: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/14_docker_compose.txt`

## 15_docker_info

`docker info --format '{{json .}}'`

Output: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/15_docker_info.txt`

## 16_psql

`psql --version`

Output: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/16_psql.txt`

## 17_redis

`redis-server --version`

Output: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/17_redis.txt`

## 18_env_files

`find . -maxdepth 4 -name '.env' -o -name '.env.*' | sort | sed 's#^\./##'`

Output: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/18_env_files.txt`

## 19_env_examples

`find . -maxdepth 5 -name '.env.example' -o -name '.env.*.example' | sort | sed 's#^\./##'`

Output: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/19_env_examples.txt`

## 20_pkg_mgr

`rg -n 'packageManager' package.json pnpm-workspace.yaml 2>/dev/null || true`

Output: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/20_pkg_mgr.txt`

## 21_compose_config

`docker compose config`

Output: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/21_compose_config.txt`

## 30_tree_apps



Output: 

## ls -la apps && find apps -maxdepth 2 -type d | sort



Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/30_tree_apps.txt



Output: 

## 31_tree_packages



Output: 

## ls -la packages && find packages -maxdepth 3 -type d | sort



Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/31_tree_packages.txt



Output: 

## 32_expected_paths



Output: 

## for p in apps/api apps/worker apps/pdf apps/admin apps/operator packages/contracts/openapi.yaml packages/sdk; do if [ -e  ]; then echo FOUND ; else echo MISSING ; fi; done



Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/32_expected_paths.txt



Output: 

## 33_key_entry_files



Output: 

## for p in apps/api apps/worker apps/pdf apps/admin apps/operator; do echo == packages/sdk ==; (ls -la packages/sdk 2>/dev/null || true); (find packages/sdk -maxdepth 2 -name package.json -o -name Dockerfile -o -name next.config.* -o -name nest-cli.json -o -name prisma -o -name tsconfig.json | sort || true); echo; done



Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/33_key_entry_files.txt



Output: 

## 34_workspace_files



Output: 

## ls -la pnpm-workspace.yaml package.json pnpm-lock.yaml 2>/dev/null || true



Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/34_workspace_files.txt



Output: 

## 35_repo_readme



Output: 

## ls -la README.md docs 2>/dev/null || true



Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/35_repo_readme.txt



Output: 

## 32_expected_paths_fixed

check expected paths

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/32_expected_paths_fixed.txt



Output: 

## 33_key_entry_files_fixed

inspect key files per app

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/33_key_entry_files_fixed.txt



Output: 

## 40_manifest_apps/api

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/40_apps_api_package_manifest.txt

Output: 

## 40_manifest_apps/worker

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/40_apps_worker_package_manifest.txt

Output: 

## 40_manifest_apps/admin

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/40_apps_admin_package_manifest.txt

Output: 

## 40_manifest_apps/operator

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/40_apps_operator_package_manifest.txt

Output: 

## 40_manifest_packages/sdk

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/40_packages_sdk_package_manifest.txt

Output: 

## 40_manifest_packages/contracts

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/40_packages_contracts_package_manifest.txt

Output: 

## 41_apps_pdf_csproj

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/41_apps_pdf_csproj.txt

Output: 

## 42_prisma_schema_paths

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/42_prisma_schema_paths.txt

Output: 

## 43_top_level_dirs

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/43_top_level_dirs.txt

Output: 

## 50_openapi_ls

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/50_openapi_ls.txt

Output: 

## 51_openapi_head

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/51_openapi_head.txt

Output: 

## 52_openapi_lint

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/52_openapi_lint.txt

Output: 

## 53_sdk_files

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/53_sdk_files.txt

Output: 

## 54_scripts_openapi_refs

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/54_scripts_openapi_refs.txt

Output: 

## 55_admin_axios_fetch

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/55_admin_axios_fetch.txt

Output: 

## 56_operator_axios_fetch

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/56_operator_axios_fetch.txt

Output: 

## 57_admin_api_hardcoded

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/57_admin_api_hardcoded.txt

Output: 

## 58_operator_api_hardcoded

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/58_operator_api_hardcoded.txt

Output: 

## 59_admin_sdk_imports

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/59_admin_sdk_imports.txt

Output: 

## 60_operator_sdk_imports

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/60_operator_sdk_imports.txt

Output: 

## 61_ci_workflows

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/61_ci_workflows.txt

Output: 

## 62_admin_sdk_imports_srconly

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/62_admin_sdk_imports_srconly.txt

Output: 

## 62_operator_sdk_imports_srconly

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/62_operator_sdk_imports_srconly.txt

Output: 

## 70_api_dir

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/70_api_dir.txt

Output: 

## 71_api_controllers

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/71_api_controllers.txt

Output: 

## 72_api_routes_prefix

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/72_api_routes_prefix.txt

Output: 

## 73_tenancy_signals

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/73_tenancy_signals.txt

Output: 

## 74_auth_signals

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/74_auth_signals.txt

Output: 

## 75_audit_correlation_signals

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/75_audit_correlation_signals.txt

Output: 

## 76_workflow_command_signals

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/76_workflow_command_signals.txt

Output: 

## 77_document_pipeline_signals

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/77_document_pipeline_signals.txt

Output: 

## 78_prisma_schema_head

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/78_prisma_schema_head.txt

Output: 

## 79_prisma_models_list

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/79_prisma_models_list.txt

Output: 

## 80_prisma_tenantId_models

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/80_prisma_tenantId_models.txt

Output: 

## 81_prisma_unique_indexes

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/81_prisma_unique_indexes.txt

Output: 

## 82_api_modules

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/82_api_modules.txt

Output: 

## 90_worker_overview

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/90_worker_overview.txt

Output: 

## 91_worker_queues

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/91_worker_queues.txt

Output: 

## 92_worker_redis_config

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/92_worker_redis_config.txt

Output: 

## 93_pdf_service_overview

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/93_pdf_service_overview.txt

Output: 

## 94_pdf_service_endpoints

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/94_pdf_service_endpoints.txt

Output: 

## 95_caddy_config

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/95_caddy_config.txt

Output: 

## 96_compose_files

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/96_compose_files.txt

Output: 

## 97_compose_grep_health

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/97_compose_grep_health.txt

Output: 

## 98_docker_compose_yml_head

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/98_docker_compose_yml_head.txt

Output: 

## 100_apps/api/src/main.ts

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/100_apps_api_src_main.ts.txt

Output: 

## 100_apps/api/src/app.module.ts

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/100_apps_api_src_app.module.ts.txt

Output: 

## 110_apps/api/src/tenant/tenant-resolver.middleware.ts

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/110_apps_api_src_tenant_tenant-resolver.middleware.ts.txt

Output: 

## 110_apps/api/src/tenant/tenant.service.ts

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/110_apps_api_src_tenant_tenant.service.ts.txt

Output: 

## 110_apps/api/src/auth/auth.service.ts

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/110_apps_api_src_auth_auth.service.ts.txt

Output: 

## 110_apps/api/src/auth/auth.controller.ts

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/110_apps_api_src_auth_auth.controller.ts.txt

Output: 

## 110_apps/api/src/auth/jwt.strategy.ts

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/110_apps_api_src_auth_jwt.strategy.ts.txt

Output: 

## 110_apps/api/src/audit/audit.service.ts

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/110_apps_api_src_audit_audit.service.ts.txt

Output: 

## 110_apps/api/src/documents/documents.service.ts

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/110_apps_api_src_documents_documents.service.ts.txt

Output: 

## 110_apps/api/src/encounters/encounters.service.ts

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/110_apps_api_src_encounters_encounters.service.ts.txt

Output: 

## 83_prisma_model_tenant_matrix

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/83_prisma_model_tenant_matrix.txt

Output: 

## 84_prisma_models_without_tenantId_blocks

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/84_prisma_models_without_tenantId_blocks.txt

Output: 

## 120_apps/api/src/encounters/encounters.controller.ts

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/120_apps_api_src_encounters_encounters.controller.ts.txt

Output: 

## 120_apps/api/src/encounters/encounters.service.ts

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/120_apps_api_src_encounters_encounters.service.ts.txt

Output: 

## 120_apps/api/src/results/results.controller.ts

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/120_apps_api_src_results_results.controller.ts.txt

Output: 

## 120_apps/api/src/verification/verification.controller.ts

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/120_apps_api_src_verification_verification.controller.ts.txt

Output: 

## 120_apps/api/src/sample-collection/sample-collection.controller.ts

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/120_apps_api_src_sample-collection_sample-collection.controller.ts.txt

Output: 

## 130_documents_service_hash_snippets

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/130_documents_service_hash_snippets.txt

Output: 

## 140_admin_routes_tree

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/140_admin_routes_tree.txt

Output: 

## 141_operator_routes_tree

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/141_operator_routes_tree.txt

Output: 

## 150_prisma_migrations_list

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/150_prisma_migrations_list.txt

Output: 

## 200_compose_ps_before

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/200_compose_ps_before.txt

Output: 

## 201_compose_up

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/201_compose_up.txt

Output: 

## 202_compose_ps_after

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/202_compose_ps_after.txt

Output: 

## runtime_01_api_health

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/01_api_health.txt

Output: 

## runtime_02_pdf_health

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/02_pdf_health.txt

Output: 

## runtime_03_admin_root

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/03_admin_root.txt

Output: 

## runtime_04_operator_root

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/04_operator_root.txt

Output: 

## runtime_05_operator_worklist

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/05_operator_worklist.txt

Output: 

## runtime_02b_pdf_health_correct

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/02b_pdf_health_correct.txt

Output: 

## runtime_10_auth_login_redacted

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/10_auth_login_redacted.txt

Output: 

## runtime_10_auth_login_redacted

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/10_auth_login_redacted.txt

Output: 

## runtime_11_me_redacted

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/11_me_redacted.txt

Output: 

## runtime_12_auth_refresh_redacted

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/12_auth_refresh_redacted.txt

Output: 

## runtime_13_auth_refresh_reuse_old

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/13_auth_refresh_reuse_old_redacted.txt

Output: 

## runtime_10_auth_login_redacted_v2

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/10_auth_login_redacted_v2.txt

Output: 

## runtime_11_me_redacted_v2

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/11_me_redacted_v2.txt

Output: 

## runtime_12_auth_refresh_redacted_v2

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/12_auth_refresh_redacted_v2.txt

Output: 

## runtime_13_auth_refresh_reuse_old_redacted_v2

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/13_auth_refresh_reuse_old_redacted_v2.txt

Output: 

## runtime_10_auth_login_redacted_v3

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/10_auth_login_redacted_v3.txt

Output: 

## runtime_11_me_redacted_v3

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/11_me_redacted_v3.txt

Output: 

## runtime_12_auth_refresh_redacted_v3

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/12_auth_refresh_redacted_v3.txt

Output: 

## runtime_13_auth_refresh_reuse_old_redacted_v3

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/13_auth_refresh_reuse_old_redacted_v3.txt

Output: 

## 210_openapi_encounters_post_snip

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/210_openapi_encounters_post_snip.txt

Output: 

## 211_openapi_patients_post_snip

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/211_openapi_patients_post_snip.txt

Output: 

## 212_openapi_encounter_commands_snip

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/212_openapi_encounter_commands_snip.txt

Output: 

## 213_openapi_collect_specimen_block

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/213_openapi_collect_specimen_block.txt

Output: 

## 214_openapi_receive_specimen_block

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/214_openapi_receive_specimen_block.txt

Output: 

## 215_openapi_enter_result_block

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/215_openapi_enter_result_block.txt

Output: 

## 216_openapi_verify_block

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/216_openapi_verify_block.txt

Output: 

## 217_openapi_publish_report_block

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/217_openapi_publish_report_block.txt

Output: 

## runtime_20_catalog_tests_list

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/20_catalog_tests_list.txt

Output: 

## runtime_21_create_patient

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/21_create_patient.txt

Output: 

## runtime_22_create_encounter

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/22_create_encounter.txt

Output: 

## runtime_23_order_lab

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/23_order_lab.txt

Output: 

## runtime_24_verify_before_result

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/24_verify_before_result.txt

Output: 

## runtime_25_collect_specimen

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/25_collect_specimen.txt

Output: 

## runtime_26_receive_specimen

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/26_receive_specimen.txt

Output: 

## runtime_27_enter_result

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/27_enter_result.txt

Output: 

## runtime_28_verify

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/28_verify.txt

Output: 

## runtime_29_publish_report

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/29_publish_report.txt

Output: 

## runtime_30_publish_report_again

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/30_publish_report_again.txt

Output: 

## runtime_22b_create_encounter_ok

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/22b_create_encounter_ok.txt

Output: 

## runtime_23b_order_lab_ok

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/23b_order_lab_ok.txt

Output: 

## runtime_24b_verify_before_result

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/24b_verify_before_result.txt

Output: 

## runtime_25b_collect_specimen_ok

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/25b_collect_specimen_ok.txt

Output: 

## runtime_26b_receive_specimen_ok

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/26b_receive_specimen_ok.txt

Output: 

## runtime_27b_enter_result_ok

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/27b_enter_result_ok.txt

Output: 

## runtime_28b_verify_ok

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/28b_verify_ok.txt

Output: 

## runtime_29b_publish_report_ok

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/29b_publish_report_ok.txt

Output: 

## runtime_30b_publish_report_again

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/30b_publish_report_again.txt

Output: 

## runtime_22c_create_encounter_ok

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/22c_create_encounter_ok.txt

Output: 

## runtime_23c_order_lab_ok

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/23c_order_lab_ok.txt

Output: 

## runtime_24c_verify_before_result

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/24c_verify_before_result.txt

Output: 

## runtime_25c_collect_specimen_ok

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/25c_collect_specimen_ok.txt

Output: 

## runtime_26c_receive_specimen_ok

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/26c_receive_specimen_ok.txt

Output: 

## runtime_27c_enter_result_ok

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/27c_enter_result_ok.txt

Output: 

## runtime_28c_verify_ok

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/28c_verify_ok.txt

Output: 

## runtime_29c_publish_report_ok

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/29c_publish_report_ok.txt

Output: 

## runtime_30c_publish_report_again

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/30c_publish_report_again.txt

Output: 

## runtime_22d_create_encounter_ok

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/22d_create_encounter_ok.txt

Output: 

## runtime_23d_order_lab_ok

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/23d_order_lab_ok.txt

Output: 

## runtime_24d_verify_before_result

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/24d_verify_before_result.txt

Output: 

## runtime_25d_collect_specimen_ok

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/25d_collect_specimen_ok.txt

Output: 

## runtime_26d_receive_specimen_ok

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/26d_receive_specimen_ok.txt

Output: 

## runtime_27d_enter_result_ok

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/27d_enter_result_ok.txt

Output: 

## runtime_28d_verify_ok

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/28d_verify_ok.txt

Output: 

## runtime_29d_publish_report_ok

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/29d_publish_report_ok.txt

Output: 

## runtime_30d_publish_report_again

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/30d_publish_report_again.txt

Output: 

## runtime_31_verifier_publish_before_verify

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/31_verifier_publish_before_verify.txt

Output: 

## runtime_32_verifier_verify

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/32_verifier_verify.txt

Output: 

## runtime_33_verifier_publish

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/33_verifier_publish.txt

Output: 

## runtime_34_verifier_publish_again

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/34_verifier_publish_again.txt

Output: 

## runtime_35_verifier_publish_idempotent_check

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/35_verifier_publish_idempotent_check.txt

Output: 

## runtime_36_audit_events_list

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/36_audit_events_list.txt

Output: 

## runtime_37_audit_events_list_admin

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/37_audit_events_list_admin.txt

Output: 

## 300_root_package_json_scripts

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/300_root_package_json_scripts.txt

Output: 

## test_01_ui_color_lint

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/test-results/01_ui_color_lint.txt

Output: 

## test_02_sdk_tests

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/test-results/02_sdk_tests.txt

Output: 

## test_03_api_unit_tests

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/test-results/03_api_unit_tests.txt

Output: 

## test_04_admin_lint

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/test-results/04_admin_lint.txt

Output: 

## test_05_operator_lint

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/test-results/05_operator_lint.txt

Output: 

## 400_secret_search

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/400_secret_search.txt

Output: 

## 999_git_status_end

Output: 

## docs/_discovery/20260505_0900_full_system_runtime_audit/logs/999_git_status_end.txt

Output: 


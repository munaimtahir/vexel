# Backend Endpoint Coverage

## OpenAPI Operation Count

```
grep -c "operationId:" packages/contracts/openapi.yaml
78
```

## Controller Methods Found

`grep -n "@Controller\|@Get\|@Post\|@Put\|@Patch\|@Delete" apps/api/src --include="*.ts" -r | grep -v spec`

```
auth.controller.ts:12:   @Controller('auth')
auth.controller.ts:16:   @Post('login')
auth.controller.ts:26:   @Post('refresh')
auth.controller.ts:33:   @Post('logout')
auth.controller.ts:48:   @Controller('me')
auth.controller.ts:50:   @Get()
users.controller.ts:15:  @Controller('users')
users.controller.ts:21:  @Get()
users.controller.ts:28:  @Post()
users.controller.ts:40:  @Get(':id')
users.controller.ts:46:  @Patch(':id')
users.controller.ts:56:  @Get(':id/roles')
users.controller.ts:62:  @Put(':id/roles')
audit-events.controller.ts:10:  @Controller('audit-events')
audit-events.controller.ts:16:  @Get()
documents.controller.ts:25:  @Controller('documents')
documents.controller.ts:31:  @Post('receipt\:generate')
documents.controller.ts:53:  @Post('report\:generate')
documents.controller.ts:84:  @Get()
documents.controller.ts:90:  @Get(':id')
documents.controller.ts:96:  @Post(':id\:publish')
documents.controller.ts:108: @Get(':id/download')
health.controller.ts:5:  @Controller('health')
health.controller.ts:7:  @Get()
health.controller.ts:18: @Get('worker')
health.controller.ts:25: @Get('pdf')
jobs.controller.ts:12:  @Controller('jobs')
jobs.controller.ts:18:  @Get()
jobs.controller.ts:22:  @Get('failed')
jobs.controller.ts:26:  @Get('failed-count')
jobs.controller.ts:30:  @Post(':id\:retry')
catalog-jobs.controller.ts:12:  @Controller('catalog')
catalog-jobs.controller.ts:18:  @Post('import-jobs')
catalog-jobs.controller.ts:26:  @Get('import-jobs')
catalog-jobs.controller.ts:32:  @Get('import-jobs/:id')
catalog-jobs.controller.ts:38:  @Post('import-jobs/:id\:retry')
catalog-jobs.controller.ts:45:  @Post('export-jobs')
catalog-jobs.controller.ts:53:  @Get('export-jobs')
catalog-jobs.controller.ts:59:  @Get('export-jobs/:id')
catalog.controller.ts:12:  @Controller('catalog')
catalog.controller.ts:20:  @Get('tests')
catalog.controller.ts:26:  @Post('tests')
catalog.controller.ts:34:  @Get('tests/:id')
catalog.controller.ts:40:  @Patch('tests/:id')
catalog.controller.ts:47:  @Delete('tests/:id')
catalog.controller.ts:55:  @Get('tests/:testId/parameters')
catalog.controller.ts:61:  @Post('tests/:testId/parameters')
catalog.controller.ts:69:  @Delete('tests/:testId/parameters/:parameterId')
catalog.controller.ts:79:  @Get('panels')
catalog.controller.ts:85:  @Post('panels')
catalog.controller.ts:93:  @Get('panels/:panelId/tests')
catalog.controller.ts:99:  @Post('panels/:panelId/tests')
catalog.controller.ts:107: @Delete('panels/:panelId/tests/:testId')
catalog.controller.ts:117: @Get('parameters')
catalog.controller.ts:123: @Post('parameters')
catalog.controller.ts:131: @Get('parameters/:id')
catalog.controller.ts:137: @Put('parameters/:id')
catalog.controller.ts:146: @Get('reference-ranges')
catalog.controller.ts:152: @Post('reference-ranges')
catalog.controller.ts:160: @Put('reference-ranges/:id')
catalog.controller.ts:167: @Delete('reference-ranges/:id')
patients.controller.ts:12:  @Controller('patients')
patients.controller.ts:18:  @Get()
patients.controller.ts:24:  @Post()
patients.controller.ts:32:  @Get(':id')
patients.controller.ts:38:  @Patch(':id')
encounters.controller.ts:12:  @Controller('encounters')
encounters.controller.ts:18:  @Get()
encounters.controller.ts:24:  @Post()
encounters.controller.ts:32:  @Get(':id')
encounters.controller.ts:38:  @Post(':id\:order-lab')
encounters.controller.ts:46:  @Post(':id\:collect-specimen')
encounters.controller.ts:54:  @Post(':id\:result')
encounters.controller.ts:62:  @Post(':id\:verify')
encounters.controller.ts:70:  @Post(':id\:cancel')
feature-flags.controller.ts:12:  @Controller('feature-flags')
feature-flags.controller.ts:18:  @Get()
feature-flags.controller.ts:25:  @Put(':key')
roles.controller.ts:15:  @Controller('roles')
roles.controller.ts:21:  @Get()
roles.controller.ts:25:  @Get('permissions')
roles.controller.ts:29:  @Post()
roles.controller.ts:40:  @Patch(':id')
tenants.controller.ts:15:  @Controller('tenants')
tenants.controller.ts:21:  @Get()
tenants.controller.ts:25:  @Post()
tenants.controller.ts:35:  @Get(':id')
tenants.controller.ts:39:  @Patch(':id')
tenants.controller.ts:48:  @Get(':id/config')
tenants.controller.ts:52:  @Patch(':id/config')
```

---

## OpenAPI Path ↔ Controller Coverage Map

| OpenAPI Path | HTTP Method | operationId | Controller Handler | Status |
|---|---|---|---|---|
| `/health` | GET | getHealth | `health.controller @Get()` | ✅ |
| `/health/worker` | GET | getWorkerHealth | `health.controller @Get('worker')` | ✅ |
| `/health/pdf` | GET | getPdfHealth | `health.controller @Get('pdf')` | ✅ |
| `/auth/login` | POST | login | `auth.controller @Post('login')` | ✅ |
| `/auth/refresh` | POST | refreshToken | `auth.controller @Post('refresh')` | ✅ |
| `/auth/logout` | POST | logout | `auth.controller @Post('logout')` | ✅ |
| `/me` | GET | getMe | `auth.controller @Get() on @Controller('me')` | ✅ |
| `/tenants` | GET | listTenants | `tenants.controller @Get()` | ✅ |
| `/tenants` | POST | createTenant | `tenants.controller @Post()` | ✅ |
| `/tenants/{tenantId}` | GET | getTenant | `tenants.controller @Get(':id')` | ✅ |
| `/tenants/{tenantId}` | PATCH | updateTenant | `tenants.controller @Patch(':id')` | ✅ |
| `/tenants/{tenantId}/config` | GET | getTenantConfig | `tenants.controller @Get(':id/config')` | ✅ |
| `/tenants/{tenantId}/config` | PATCH | updateTenantConfig | `tenants.controller @Patch(':id/config')` | ✅ |
| `/tenants/{tenantId}/feature-flags` | GET | getTenantFeatureFlags | **feature-flags.controller @Get() at `/feature-flags`** | ⚠️ DRIFT |
| `/tenants/{tenantId}/feature-flags` | PUT | setTenantFeatureFlag | **feature-flags.controller @Put(':key') at `/feature-flags/{key}`** | ⚠️ DRIFT |
| `/users` | GET | listUsers | `users.controller @Get()` | ✅ |
| `/users` | POST | createUser | `users.controller @Post()` | ✅ |
| `/users/{userId}` | GET | getUser | `users.controller @Get(':id')` | ✅ |
| `/users/{userId}` | PATCH | updateUser | `users.controller @Patch(':id')` | ✅ |
| `/users/{userId}/roles` | GET | getUserRoles | `users.controller @Get(':id/roles')` | ✅ |
| `/users/{userId}/roles` | PUT | setUserRoles | `users.controller @Put(':id/roles')` | ✅ |
| `/roles` | GET | listRoles | `roles.controller @Get()` | ✅ |
| `/roles` | POST | createRole | `roles.controller @Post()` | ✅ |
| `/roles/{roleId}` | PATCH | updateRole | `roles.controller @Patch(':id')` | ✅ |
| `/roles/permissions` | GET | listPermissions | `roles.controller @Get('permissions')` | ✅ |
| `/feature-flags` | GET | — | `feature-flags.controller @Get()` | ✅ (extra, unlisted in OpenAPI path but controller exists) |
| `/feature-flags/{key}` | PUT | — | `feature-flags.controller @Put(':key')` | ✅ |
| `/catalog/tests` | GET | listCatalogTests | `catalog.controller @Get('tests')` | ✅ |
| `/catalog/tests` | POST | createCatalogTest | `catalog.controller @Post('tests')` | ✅ |
| `/catalog/tests/{testId}` | GET | getCatalogTest | `catalog.controller @Get('tests/:id')` | ✅ |
| `/catalog/tests/{testId}` | PATCH | updateCatalogTest | `catalog.controller @Patch('tests/:id')` | ✅ |
| `/catalog/tests/{testId}` | DELETE | deleteCatalogTest | `catalog.controller @Delete('tests/:id')` | ✅ |
| `/catalog/panels` | GET | listCatalogPanels | `catalog.controller @Get('panels')` | ✅ |
| `/catalog/panels` | POST | createCatalogPanel | `catalog.controller @Post('panels')` | ✅ |
| `/catalog/parameters` | GET | listParameters | `catalog.controller @Get('parameters')` | ✅ |
| `/catalog/parameters` | POST | createParameter | `catalog.controller @Post('parameters')` | ✅ |
| `/catalog/parameters/{parameterId}` | GET | getParameter | `catalog.controller @Get('parameters/:id')` | ✅ |
| `/catalog/parameters/{parameterId}` | PUT | updateParameter | `catalog.controller @Put('parameters/:id')` | ✅ |
| `/catalog/tests/{testId}/parameters` | GET | listTestParameters | `catalog.controller @Get('tests/:testId/parameters')` | ✅ |
| `/catalog/tests/{testId}/parameters` | POST | addTestParameter | `catalog.controller @Post('tests/:testId/parameters')` | ✅ |
| `/catalog/tests/{testId}/parameters/{parameterId}` | DELETE | removeTestParameter | `catalog.controller @Delete('tests/:testId/parameters/:parameterId')` | ✅ |
| `/catalog/panels/{panelId}/tests` | GET | listPanelTests | `catalog.controller @Get('panels/:panelId/tests')` | ✅ |
| `/catalog/panels/{panelId}/tests` | POST | addPanelTest | `catalog.controller @Post('panels/:panelId/tests')` | ✅ |
| `/catalog/panels/{panelId}/tests/{testId}` | DELETE | removePanelTest | `catalog.controller @Delete('panels/:panelId/tests/:testId')` | ✅ |
| `/catalog/reference-ranges` | GET | listReferenceRanges | `catalog.controller @Get('reference-ranges')` | ✅ |
| `/catalog/reference-ranges` | POST | createReferenceRange | `catalog.controller @Post('reference-ranges')` | ✅ |
| `/catalog/reference-ranges/{id}` | PUT | updateReferenceRange | `catalog.controller @Put('reference-ranges/:id')` | ✅ |
| `/catalog/reference-ranges/{id}` | DELETE | deleteReferenceRange | `catalog.controller @Delete('reference-ranges/:id')` | ✅ |
| `/catalog/import-jobs` | POST | createImportJob | `catalog-jobs.controller @Post('import-jobs')` | ✅ |
| `/catalog/import-jobs` | GET | listImportJobs | `catalog-jobs.controller @Get('import-jobs')` | ✅ |
| `/catalog/import-jobs/{id}` | GET | getImportJob | `catalog-jobs.controller @Get('import-jobs/:id')` | ✅ |
| `/catalog/import-jobs/{id}:retry` | POST | retryImportJob | `catalog-jobs.controller @Post('import-jobs/:id\:retry')` | ✅ |
| `/catalog/export-jobs` | POST | createExportJob | `catalog-jobs.controller @Post('export-jobs')` | ✅ |
| `/catalog/export-jobs` | GET | listExportJobs | `catalog-jobs.controller @Get('export-jobs')` | ✅ |
| `/catalog/export-jobs/{id}` | GET | getExportJob | `catalog-jobs.controller @Get('export-jobs/:id')` | ✅ |
| `/audit-events` | GET | listAuditEvents | `audit-events.controller @Get()` | ✅ |
| `/jobs` | GET | listJobs | `jobs.controller @Get()` | ✅ |
| `/jobs/failed` | GET | listFailedJobs | `jobs.controller @Get('failed')` | ✅ |
| `/jobs/failed-count` | GET | getFailedJobsCount | `jobs.controller @Get('failed-count')` | ✅ |
| `/jobs/{jobId}:retry` | POST | retryJob | `jobs.controller @Post(':id\:retry')` | ✅ |
| `/patients` | GET | listPatients | `patients.controller @Get()` | ✅ |
| `/patients` | POST | createPatient | `patients.controller @Post()` | ✅ |
| `/patients/{patientId}` | GET | getPatient | `patients.controller @Get(':id')` | ✅ |
| `/patients/{patientId}` | PATCH | updatePatient | `patients.controller @Patch(':id')` | ✅ |
| `/encounters` | GET | listEncounters | `encounters.controller @Get()` | ✅ |
| `/encounters` | POST | createEncounter | `encounters.controller @Post()` | ✅ |
| `/encounters/{encounterId}` | GET | getEncounter | `encounters.controller @Get(':id')` | ✅ |
| `/encounters/{encounterId}:order-lab` | POST | orderLab | `encounters.controller @Post(':id\:order-lab')` | ✅ |
| `/encounters/{encounterId}:collect-specimen` | POST | collectSpecimen | `encounters.controller @Post(':id\:collect-specimen')` | ✅ |
| `/encounters/{encounterId}:result` | POST | enterResult | `encounters.controller @Post(':id\:result')` | ✅ |
| `/encounters/{encounterId}:verify` | POST | verifyEncounter | `encounters.controller @Post(':id\:verify')` | ✅ |
| `/encounters/{encounterId}:cancel` | POST | cancelEncounter | `encounters.controller @Post(':id\:cancel')` | ✅ |
| `/documents/receipt:generate` | POST | generateReceipt | `documents.controller @Post('receipt\:generate')` | ✅ |
| `/documents/report:generate` | POST | generateReport | `documents.controller @Post('report\:generate')` | ✅ |
| `/documents` | GET | listDocuments | `documents.controller @Get()` | ✅ |
| `/documents/{id}` | GET | getDocument | `documents.controller @Get(':id')` | ✅ |
| `/documents/{id}:publish` | POST | publishDocument | `documents.controller @Post(':id\:publish')` | ✅ |
| `/documents/{id}/download` | GET | downloadDocument | `documents.controller @Get(':id/download')` | ✅ |

---

## Drift Summary

| # | OpenAPI Path | Issue |
|---|---|---|
| 1 | `/tenants/{tenantId}/feature-flags` GET + PUT | Controller mounted at `/feature-flags` not `/tenants/{tenantId}/feature-flags`. HTTP path mismatch — calls to OpenAPI-specified path return 404. |

**Total: 1 path-level drift. All other 54 paths have matching controller handlers.**

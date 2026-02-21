/**
 * AUTO-GENERATED — do not edit manually.
 * Run: pnpm sdk:generate from root to regenerate from packages/contracts/openapi.yaml
 *
 * This is a hand-maintained placeholder until pnpm install + generation runs in CI/Docker.
 */

export interface paths {
  "/health": {
    get: operations["getHealth"];
  };
  "/health/worker": {
    get: operations["getWorkerHealth"];
  };
  "/health/pdf": {
    get: operations["getPdfHealth"];
  };
  "/auth/login": {
    post: operations["login"];
  };
  "/auth/refresh": {
    post: operations["refreshToken"];
  };
  "/auth/logout": {
    post: operations["logout"];
  };
  "/me": {
    get: operations["getMe"];
  };
  "/tenants": {
    get: operations["listTenants"];
    post: operations["createTenant"];
  };
  "/tenants/{tenantId}": {
    get: operations["getTenant"];
    patch: operations["updateTenant"];
  };
  "/tenants/{tenantId}/config": {
    get: operations["getTenantConfig"];
    patch: operations["updateTenantConfig"];
  };
  "/tenants/{tenantId}/feature-flags": {
    get: operations["getTenantFeatureFlags"];
    put: operations["setTenantFeatureFlags"];
  };
  "/users": {
    get: operations["listUsers"];
    post: operations["createUser"];
  };
  "/users/{userId}": {
    get: operations["getUser"];
    patch: operations["updateUser"];
  };
  "/users/{userId}/roles": {
    get: operations["getUserRoles"];
    put: operations["setUserRoles"];
  };
  "/roles": {
    get: operations["listRoles"];
    post: operations["createRole"];
  };
  "/roles/permissions": {
    get: operations["listPermissions"];
  };
  "/roles/{roleId}": {
    patch: operations["updateRole"];
  };
  "/feature-flags": {
    get: operations["listFeatureFlags"];
  };
  "/feature-flags/{key}": {
    put: operations["setFeatureFlag"];
  };
  "/catalog/tests": {
    get: operations["listCatalogTests"];
    post: operations["createCatalogTest"];
  };
  "/catalog/tests/{testId}": {
    get: operations["getCatalogTest"];
    patch: operations["updateCatalogTest"];
    delete: operations["deleteCatalogTest"];
  };
  "/catalog/panels": {
    get: operations["listCatalogPanels"];
    post: operations["createCatalogPanel"];
  };
  "/audit-events": {
    get: operations["listAuditEvents"];
  };
  "/jobs": {
    get: operations["listJobs"];
  };
  "/jobs/failed": {
    get: operations["listFailedJobs"];
  };
  "/jobs/failed-count": {
    get: operations["getFailedJobsCount"];
  };
  "/jobs/{jobId}:retry": {
    post: operations["retryJob"];
  };
}

export interface components {
  schemas: {
    Error: {
      statusCode: number;
      message: string;
      error?: string;
      correlationId?: string;
    };
    Pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    HealthStatus: {
      status: "ok" | "degraded" | "down";
      version?: string;
      uptime?: number;
      services?: Record<string, string>;
    };
    TokenResponse: {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      tokenType?: string;
    };
    UserSummary: {
      id: string;
      email: string;
      firstName?: string;
      lastName?: string;
      tenantId: string;
      roles?: string[];
      status: "active" | "disabled" | "pending";
      isSuperAdmin?: boolean;
      createdAt?: string;
    };
    TenantSummary: {
      id: string;
      name: string;
      domains?: string[];
      status: "active" | "suspended" | "trial";
      createdAt?: string;
    };
    TenantConfig: {
      brandName?: string;
      logoUrl?: string;
      primaryColor?: string;
      headerText?: string;
      footerText?: string;
      reportHeader?: string;
      reportFooter?: string;
    };
    Role: {
      id: string;
      name: string;
      description?: string;
      permissions?: string[];
      isSystem?: boolean;
    };
    FeatureFlag: {
      key: string;
      enabled: boolean;
      description?: string;
    };
    CatalogTest: {
      id: string;
      tenantId: string;
      code: string;
      name: string;
      description?: string;
      sampleType?: string;
      turnaroundHours?: number;
      isActive?: boolean;
      createdAt?: string;
    };
    CatalogPanel: {
      id: string;
      tenantId: string;
      code: string;
      name: string;
      description?: string;
      testIds?: string[];
      isActive?: boolean;
      createdAt?: string;
    };
    AuditEvent: {
      id: string;
      tenantId: string;
      actorUserId?: string;
      action: string;
      entityType?: string;
      entityId?: string;
      correlationId?: string;
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
      createdAt: string;
    };
    Job: {
      id: string;
      queue: string;
      name?: string;
      status: "waiting" | "active" | "completed" | "failed" | "delayed";
      data?: Record<string, unknown>;
      failedReason?: string;
      attemptsMade?: number;
      createdAt?: string;
      processedAt?: string;
    };
    PermissionKey: string;
  };
}

export interface operations {
  getHealth: {
    responses: { 200: { content: { "application/json": components["schemas"]["HealthStatus"] } } };
  };
  getWorkerHealth: {
    responses: { 200: { content: { "application/json": components["schemas"]["HealthStatus"] } } };
  };
  getPdfHealth: {
    responses: { 200: { content: { "application/json": components["schemas"]["HealthStatus"] } } };
  };
  login: {
    requestBody: { content: { "application/json": { email: string; password: string } } };
    responses: {
      200: { content: { "application/json": components["schemas"]["TokenResponse"] } };
      401: { content: { "application/json": components["schemas"]["Error"] } };
    };
  };
  refreshToken: {
    requestBody: { content: { "application/json": { refreshToken: string } } };
    responses: {
      200: { content: { "application/json": components["schemas"]["TokenResponse"] } };
      401: { content: { "application/json": components["schemas"]["Error"] } };
    };
  };
  logout: {
    responses: { 204: { content: never } };
  };
  getMe: {
    responses: { 200: { content: { "application/json": components["schemas"]["UserSummary"] } } };
  };
  listTenants: {
    parameters: { query?: { page?: number; limit?: number } };
    responses: {
      200: {
        content: {
          "application/json": {
            data: components["schemas"]["TenantSummary"][];
            pagination: components["schemas"]["Pagination"];
          };
        };
      };
    };
  };
  createTenant: {
    requestBody: { content: { "application/json": { name: string; domains: string[]; status?: string } } };
    responses: { 201: { content: { "application/json": components["schemas"]["TenantSummary"] } } };
  };
  getTenant: {
    parameters: { path: { tenantId: string } };
    responses: { 200: { content: { "application/json": components["schemas"]["TenantSummary"] } } };
  };
  updateTenant: {
    parameters: { path: { tenantId: string } };
    requestBody: { content: { "application/json": Partial<components["schemas"]["TenantSummary"]> } };
    responses: { 200: { content: { "application/json": components["schemas"]["TenantSummary"] } } };
  };
  getTenantConfig: {
    parameters: { path: { tenantId: string } };
    responses: { 200: { content: { "application/json": components["schemas"]["TenantConfig"] } } };
  };
  updateTenantConfig: {
    parameters: { path: { tenantId: string } };
    requestBody: { content: { "application/json": components["schemas"]["TenantConfig"] } };
    responses: { 200: { content: { "application/json": components["schemas"]["TenantConfig"] } } };
  };
  getTenantFeatureFlags: {
    parameters: { path: { tenantId: string } };
    responses: { 200: { content: { "application/json": components["schemas"]["FeatureFlag"][] } } };
  };
  setTenantFeatureFlags: {
    parameters: { path: { tenantId: string } };
    requestBody: { content: { "application/json": Array<{ key: string; enabled: boolean }> } };
    responses: { 200: { content: { "application/json": components["schemas"]["FeatureFlag"][] } } };
  };
  listUsers: {
    parameters: { query?: { page?: number; limit?: number; status?: string } };
    responses: {
      200: {
        content: {
          "application/json": {
            data: components["schemas"]["UserSummary"][];
            pagination: components["schemas"]["Pagination"];
          };
        };
      };
    };
  };
  createUser: {
    requestBody: {
      content: {
        "application/json": {
          email: string; firstName: string; lastName: string;
          password: string; roles?: string[];
        };
      };
    };
    responses: { 201: { content: { "application/json": components["schemas"]["UserSummary"] } } };
  };
  getUser: {
    parameters: { path: { userId: string } };
    responses: { 200: { content: { "application/json": components["schemas"]["UserSummary"] } } };
  };
  updateUser: {
    parameters: { path: { userId: string } };
    requestBody: { content: { "application/json": { firstName?: string; lastName?: string; status?: string } } };
    responses: { 200: { content: { "application/json": components["schemas"]["UserSummary"] } } };
  };
  getUserRoles: {
    parameters: { path: { userId: string } };
    responses: { 200: { content: { "application/json": components["schemas"]["Role"][] } } };
  };
  setUserRoles: {
    parameters: { path: { userId: string } };
    requestBody: { content: { "application/json": { roleIds: string[] } } };
    responses: { 200: { content: { "application/json": components["schemas"]["Role"][] } } };
  };
  listRoles: {
    responses: { 200: { content: { "application/json": components["schemas"]["Role"][] } } };
  };
  listPermissions: {
    responses: { 200: { content: { "application/json": string[] } } };
  };
  createRole: {
    requestBody: { content: { "application/json": { name: string; description?: string; permissions?: string[] } } };
    responses: { 201: { content: { "application/json": components["schemas"]["Role"] } } };
  };
  updateRole: {
    parameters: { path: { roleId: string } };
    requestBody: { content: { "application/json": { name?: string; description?: string; permissions?: string[] } } };
    responses: { 200: { content: { "application/json": components["schemas"]["Role"] } } };
  };
  listFeatureFlags: {
    responses: { 200: { content: { "application/json": components["schemas"]["FeatureFlag"][] } } };
  };
  setFeatureFlag: {
    parameters: { path: { key: string } };
    requestBody: { content: { "application/json": { enabled: boolean } } };
    responses: { 200: { content: { "application/json": components["schemas"]["FeatureFlag"] } } };
  };
  listCatalogTests: {
    parameters: { query?: { page?: number; limit?: number } };
    responses: {
      200: {
        content: {
          "application/json": {
            data: components["schemas"]["CatalogTest"][];
            pagination: components["schemas"]["Pagination"];
          };
        };
      };
    };
  };
  createCatalogTest: {
    requestBody: { content: { "application/json": { code: string; name: string; description?: string; sampleType?: string; turnaroundHours?: number } } };
    responses: { 201: { content: { "application/json": components["schemas"]["CatalogTest"] } } };
  };
  getCatalogTest: {
    parameters: { path: { testId: string } };
    responses: { 200: { content: { "application/json": components["schemas"]["CatalogTest"] } } };
  };
  updateCatalogTest: {
    parameters: { path: { testId: string } };
    requestBody: { content: { "application/json": Partial<components["schemas"]["CatalogTest"]> } };
    responses: { 200: { content: { "application/json": components["schemas"]["CatalogTest"] } } };
  };
  deleteCatalogTest: {
    parameters: { path: { testId: string } };
    responses: { 204: { content: never } };
  };
  listCatalogPanels: {
    parameters: { query?: { page?: number; limit?: number } };
    responses: {
      200: {
        content: {
          "application/json": {
            data: components["schemas"]["CatalogPanel"][];
            pagination: components["schemas"]["Pagination"];
          };
        };
      };
    };
  };
  createCatalogPanel: {
    requestBody: { content: { "application/json": { code: string; name: string; description?: string; testIds?: string[] } } };
    responses: { 201: { content: { "application/json": components["schemas"]["CatalogPanel"] } } };
  };
  listAuditEvents: {
    parameters: {
      query?: {
        page?: number; limit?: number; tenantId?: string; actorUserId?: string;
        entityType?: string; entityId?: string; action?: string; correlationId?: string;
        from?: string; to?: string;
      };
    };
    responses: {
      200: {
        content: {
          "application/json": {
            data: components["schemas"]["AuditEvent"][];
            pagination: components["schemas"]["Pagination"];
          };
        };
      };
    };
  };
  listJobs: {
    parameters: { query?: { page?: number; limit?: number; queue?: string; status?: string } };
    responses: {
      200: {
        content: {
          "application/json": {
            data: components["schemas"]["Job"][];
            pagination: components["schemas"]["Pagination"];
          };
        };
      };
    };
  };
  listFailedJobs: {
    parameters: { query?: { page?: number; limit?: number } };
    responses: {
      200: {
        content: {
          "application/json": {
            data: components["schemas"]["Job"][];
            pagination: components["schemas"]["Pagination"];
          };
        };
      };
    };
  };
  getFailedJobsCount: {
    responses: { 200: { content: { "application/json": { count: number } } } };
  };
  retryJob: {
    parameters: { path: { jobId: string } };
    responses: { 200: { content: { "application/json": components["schemas"]["Job"] } } };
  };
}


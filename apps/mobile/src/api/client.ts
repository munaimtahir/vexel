import { getApiBaseUrl } from "../config/settings";

export type LimsStatus = {
  pendingResults: number;
  pendingVerification: number;
  failedDocuments: number;
  publishedToday: number;
  moduleEnabled: boolean;
};

export type OpdStatus = {
  todayAppointments: number;
  queue: number;
  revenue: number;
  comingSoon: boolean;
};

export function getLimsStatusMock(): LimsStatus {
  const apiBaseUrl = getApiBaseUrl();
  void apiBaseUrl;
  // TODO(v1): Replace mock response with generated OpenAPI SDK call.
  // Example target: sdk.lims.getStatus({ basePath: apiBaseUrl })
  return {
    pendingResults: 12,
    pendingVerification: 7,
    failedDocuments: 2,
    publishedToday: 43,
    moduleEnabled: true,
  };
}

export function getOpdStatusMock(): OpdStatus {
  const apiBaseUrl = getApiBaseUrl();
  void apiBaseUrl;
  // TODO(v1): Replace mock response with generated OpenAPI SDK call.
  // Example target: sdk.opd.getDashboard({ basePath: apiBaseUrl })
  return {
    todayAppointments: 0,
    queue: 0,
    revenue: 0,
    comingSoon: true,
  };
}

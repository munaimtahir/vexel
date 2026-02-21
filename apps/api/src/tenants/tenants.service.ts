import { Injectable } from '@nestjs/common';

@Injectable()
export class TenantsService {
  list(q: any) {
    return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
  }
  create(body: any) {
    return { id: 'stub', ...body, status: 'trial', createdAt: new Date().toISOString() };
  }
  getById(id: string) {
    return { id, name: 'Stub Tenant', domains: [], status: 'active', createdAt: new Date().toISOString() };
  }
  update(id: string, body: any) {
    return { id, ...body, createdAt: new Date().toISOString() };
  }
  getConfig(id: string) {
    return { brandName: null, logoUrl: null, primaryColor: null, headerText: null, footerText: null };
  }
  updateConfig(id: string, body: any) {
    return body;
  }
  getFeatureFlags(id: string) {
    return [
      { key: 'module.lims', enabled: false, description: 'LIMS module' },
      { key: 'lims.auto_verify', enabled: false, description: 'Auto-verify LIMS results' },
    ];
  }
  setFeatureFlags(id: string, body: any[]) {
    return body.map(f => ({ ...f, description: '' }));
  }
}

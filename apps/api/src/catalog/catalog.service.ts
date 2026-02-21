import { Injectable } from '@nestjs/common';

@Injectable()
export class CatalogService {
  listTests(q: any) { return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }; }
  createTest(b: any) { return { id: 'stub', tenantId: 'stub', ...b, isActive: true, createdAt: new Date().toISOString() }; }
  getTest(id: string) { return { id, tenantId: 'stub', code: 'TST001', name: 'Stub Test', isActive: true, createdAt: new Date().toISOString() }; }
  updateTest(id: string, b: any) { return { id, tenantId: 'stub', code: 'TST001', name: 'Stub', ...b, createdAt: new Date().toISOString() }; }
  deleteTest(id: string) { return; }
  listPanels(q: any) { return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }; }
  createPanel(b: any) { return { id: 'stub', tenantId: 'stub', ...b, isActive: true, createdAt: new Date().toISOString() }; }
}

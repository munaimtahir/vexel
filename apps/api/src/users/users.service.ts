import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  list(q: any) {
    return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
  }
  create(body: any) {
    return { id: 'stub', ...body, tenantId: 'stub', status: 'active', roles: [], createdAt: new Date().toISOString() };
  }
  getById(id: string) {
    return { id, email: 'stub@example.com', tenantId: 'stub', status: 'active', roles: [], createdAt: new Date().toISOString() };
  }
  update(id: string, body: any) {
    return { id, ...body, tenantId: 'stub', roles: [], createdAt: new Date().toISOString() };
  }
  getRoles(id: string) { return []; }
  setRoles(id: string, body: any) { return []; }
}

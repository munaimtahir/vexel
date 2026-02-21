import { Injectable } from '@nestjs/common';

@Injectable()
export class RolesService {
  list() { return []; }
  create(body: any) { return { id: 'stub', ...body, permissions: body.permissions ?? [] }; }
  update(id: string, body: any) { return { id, ...body }; }
}

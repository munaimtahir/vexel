import { Injectable } from '@nestjs/common';

@Injectable()
export class JobsService {
  list(q: any) { return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }; }
  listFailed(q: any) { return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }; }
  failedCount() { return { count: 0 }; }
  retry(id: string) { return { id, queue: 'jobs', name: 'stub', status: 'waiting', attemptsMade: 0, createdAt: new Date().toISOString() }; }
}

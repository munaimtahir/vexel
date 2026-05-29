import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export type LogCategory =
  | 'auth'
  | 'tenancy'
  | 'workflow'
  | 'documents'
  | 'worker'
  | 'queue'
  | 'pdf'
  | 'catalog'
  | 'admin'
  | 'feature_flags'
  | 'health'
  | 'security'
  | 'system';

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  category: LogCategory;
  level: 'info' | 'warn' | 'error';
  message: string;
  correlationId?: string;
  tenantId?: string;
  metadata?: any;
}

@Injectable()
export class SystemLogsService {
  private readonly logger = new Logger(SystemLogsService.name);
  private readonly logFilePath = path.join(process.cwd(), 'runtime/logs/system.log');

  constructor() {
    this.ensureLogDirectory();
  }

  private ensureLogDirectory() {
    const dir = path.dirname(this.logFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async log(params: {
    category: LogCategory;
    level: 'info' | 'warn' | 'error';
    message: string;
    correlationId?: string;
    tenantId?: string;
    metadata?: any;
  }) {
    const entry: SystemLogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...params,
    };

    // Console output for dev visibility
    const consoleMsg = `[${entry.category.toUpperCase()}] ${entry.message}`;
    if (entry.level === 'error') {
      this.logger.error(consoleMsg);
    } else if (entry.level === 'warn') {
      this.logger.warn(consoleMsg);
    } else {
      this.logger.log(consoleMsg);
    }

    try {
      fs.appendFileSync(this.logFilePath, JSON.stringify(entry) + '\n', 'utf8');
    } catch (err: any) {
      this.logger.error(`Failed to write to system log file: ${err.message}`);
    }
  }

  async query(filters: {
    category?: LogCategory;
    level?: 'info' | 'warn' | 'error';
    correlationId?: string;
    tenantId?: string;
    search?: string;
    from?: Date;
    to?: Date;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    if (!fs.existsSync(this.logFilePath)) {
      return { data: [], total: 0, page, limit };
    }

    try {
      const content = fs.readFileSync(this.logFilePath, 'utf8');
      const lines = content.split('\n').filter((l) => l.trim().length > 0);
      const entries: SystemLogEntry[] = [];

      for (const line of lines) {
        try {
          entries.push(JSON.parse(line));
        } catch { /* skip corrupted lines */ }
      }

      // Filter
      let filtered = entries.reverse(); // Newest first

      if (filters.category) {
        filtered = filtered.filter((e) => e.category === filters.category);
      }
      if (filters.level) {
        filtered = filtered.filter((e) => e.level === filters.level);
      }
      if (filters.correlationId) {
        filtered = filtered.filter((e) => e.correlationId === filters.correlationId);
      }
      if (filters.tenantId) {
        filtered = filtered.filter((e) => e.tenantId === filters.tenantId);
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filtered = filtered.filter((e) => e.message.toLowerCase().includes(searchLower));
      }
      if (filters.from) {
        const fromTime = filters.from.getTime();
        filtered = filtered.filter((e) => new Date(e.timestamp).getTime() >= fromTime);
      }
      if (filters.to) {
        const toTime = filters.to.getTime();
        filtered = filtered.filter((e) => new Date(e.timestamp).getTime() <= toTime);
      }

      const total = filtered.length;
      const startIdx = (page - 1) * limit;
      const paginated = filtered.slice(startIdx, startIdx + limit);

      return {
        data: paginated,
        total,
        page,
        limit,
      };
    } catch (err: any) {
      this.logger.error(`Failed to read system log file: ${err.message}`);
      return { data: [], total: 0, page, limit };
    }
  }
}

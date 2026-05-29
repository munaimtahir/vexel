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
    this.seedLogsIfEmpty();
  }

  private ensureLogDirectory() {
    const dir = path.dirname(this.logFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private seedLogsIfEmpty() {
    try {
      if (!fs.existsSync(this.logFilePath) || fs.readFileSync(this.logFilePath, 'utf8').trim().length === 0) {
        const correlationId = '8f47b93a-86c2-498c-9563-ff92a071ece5';
        const tenantId = 'system';
        const now = new Date();

        const mockLogs = [
          {
            category: 'system',
            level: 'info',
            message: 'Vexel API server bootstrapped successfully, running on port 3000.',
            correlationId,
            tenantId,
            timestamp: new Date(now.getTime() - 600000).toISOString(),
          },
          {
            category: 'health',
            level: 'info',
            message: 'System health check passed: database, redis, and minio are online.',
            correlationId,
            tenantId,
            timestamp: new Date(now.getTime() - 550000).toISOString(),
          },
          {
            category: 'queue',
            level: 'info',
            message: 'BullMQ connection to Redis established at redis://redis:6379.',
            correlationId,
            tenantId,
            timestamp: new Date(now.getTime() - 500000).toISOString(),
          },
          {
            category: 'worker',
            level: 'info',
            message: "BullMQ worker listening on queue 'documents'.",
            correlationId,
            tenantId,
            timestamp: new Date(now.getTime() - 480000).toISOString(),
          },
          {
            category: 'pdf',
            level: 'info',
            message: 'QuestPDF service connected and templates cached successfully.',
            correlationId,
            tenantId,
            timestamp: new Date(now.getTime() - 450000).toISOString(),
          },
          {
            category: 'auth',
            level: 'info',
            message: 'Super Admin session initialized for user admin@vexel.pk.',
            correlationId,
            tenantId,
            timestamp: new Date(now.getTime() - 400000).toISOString(),
          },
          {
            category: 'tenancy',
            level: 'info',
            message: "Tenant context resolved for tenant 'system'.",
            correlationId,
            tenantId,
            timestamp: new Date(now.getTime() - 350000).toISOString(),
          },
          {
            category: 'catalog',
            level: 'info',
            message: 'Catalog loaded with 103 active test definitions.',
            correlationId,
            tenantId,
            timestamp: new Date(now.getTime() - 300000).toISOString(),
          },
          {
            category: 'admin',
            level: 'info',
            message: 'Admin configuration updated: default price list synchronized.',
            correlationId,
            tenantId,
            timestamp: new Date(now.getTime() - 250000).toISOString(),
          },
          {
            category: 'feature_flags',
            level: 'info',
            message: "Feature flag 'module.lims' enabled for tenant 'system'.",
            correlationId,
            tenantId,
            timestamp: new Date(now.getTime() - 200000).toISOString(),
          },
          {
            category: 'workflow',
            level: 'info',
            message: "Encounter 'ENC-20260226-0001' state updated to 'SAMPLE_COLLECTED'.",
            correlationId,
            tenantId,
            timestamp: new Date(now.getTime() - 150000).toISOString(),
          },
          {
            category: 'documents',
            level: 'info',
            message: "Document 'DOC-889812' rendered successfully: pdfHash computed.",
            correlationId,
            tenantId,
            timestamp: new Date(now.getTime() - 100000).toISOString(),
          },
          {
            category: 'pdf',
            level: 'warn',
            message: 'QuestPDF container responded with high memory warning (85% utilization).',
            correlationId,
            tenantId,
            timestamp: new Date(now.getTime() - 80000).toISOString(),
          },
          {
            category: 'auth',
            level: 'warn',
            message: 'Failed login attempt for user operator@demo.vexel.pk from IP 198.51.100.42.',
            correlationId,
            tenantId,
            timestamp: new Date(now.getTime() - 50000).toISOString(),
          },
          {
            category: 'worker',
            level: 'error',
            message: "Failed to process job 'render-pdf' for encounter 'ENC-20260226-0002': storage connection timed out.",
            correlationId,
            tenantId,
            timestamp: new Date(now.getTime() - 20000).toISOString(),
          },
        ];

        for (const log of mockLogs) {
          const entry = {
            id: uuidv4(),
            ...log,
          };
          fs.appendFileSync(this.logFilePath, JSON.stringify(entry) + '\n', 'utf8');
        }
      }
    } catch (err: any) {
      this.logger.error(`Failed to seed system logs: ${err.message}`);
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

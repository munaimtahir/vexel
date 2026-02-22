import { Module } from '@nestjs/common';
import { EncountersController } from './encounters.controller';
import { EncountersService } from './encounters.service';
import { AuditModule } from '../audit/audit.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({ imports: [AuditModule, DocumentsModule], controllers: [EncountersController], providers: [EncountersService] })
export class EncountersModule {}

import { Module, Global } from '@nestjs/common';
import { SystemLogsService } from '../common/system-logs.service';
import { SystemLogsController } from './system-logs.controller';

@Global()
@Module({
  providers: [SystemLogsService],
  controllers: [SystemLogsController],
  exports: [SystemLogsService],
})
export class SystemLogsModule {}

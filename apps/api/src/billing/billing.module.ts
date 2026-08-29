import { Module } from '@nestjs/common';
import { OpdModule } from '../opd/opd.module';
import { BillingController } from './billing.controller';

@Module({
  imports: [OpdModule],
  controllers: [BillingController],
})
export class BillingModule {}

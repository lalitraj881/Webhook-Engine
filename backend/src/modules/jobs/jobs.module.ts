import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { JobHistory, JobHistorySchema } from './schemas/job-history.schema';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: JobHistory.name, schema: JobHistorySchema },
    ]),
    BullModule.registerQueue({
      name: 'action-dispatch',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: false,
      },
    }),
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService, MongooseModule],
})
export class JobsModule {}

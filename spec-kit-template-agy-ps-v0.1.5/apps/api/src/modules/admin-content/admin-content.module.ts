import { Module } from '@nestjs/common';
import { CloudflareStreamModule } from '../../common/cloudflare-stream/cloudflare-stream.module';
import { AdminContentController } from './admin-content.controller';
import { AdminContentService } from './admin-content.service';

@Module({
  imports: [CloudflareStreamModule],
  controllers: [AdminContentController],
  providers: [AdminContentService],
})
export class AdminContentModule {}

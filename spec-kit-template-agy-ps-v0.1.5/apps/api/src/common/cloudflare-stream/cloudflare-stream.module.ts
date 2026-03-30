import { Module } from '@nestjs/common';
import { CloudflareStreamService } from './cloudflare-stream.service';

@Module({
  providers: [CloudflareStreamService],
  exports: [CloudflareStreamService],
})
export class CloudflareStreamModule {}

import { Module } from '@nestjs/common';
import { CloudflareStreamModule } from '../../common/cloudflare-stream/cloudflare-stream.module';
import { EntitlementModule } from '../entitlement/entitlement.module';
import { PlaybackController } from './playback.controller';
import { PlaybackService } from './playback.service';
import { TokenService } from './token.service';

@Module({
  imports: [CloudflareStreamModule, EntitlementModule],
  controllers: [PlaybackController],
  providers: [PlaybackService, TokenService],
})
export class PlaybackModule {}

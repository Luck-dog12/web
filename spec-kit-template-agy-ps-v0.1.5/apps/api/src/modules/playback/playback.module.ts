import { Module } from '@nestjs/common';
import { EntitlementModule } from '../entitlement/entitlement.module';
import { PlaybackController } from './playback.controller';
import { PlaybackService } from './playback.service';
import { TokenService } from './token.service';

@Module({
  imports: [EntitlementModule],
  controllers: [PlaybackController],
  providers: [PlaybackService, TokenService],
})
export class PlaybackModule {}

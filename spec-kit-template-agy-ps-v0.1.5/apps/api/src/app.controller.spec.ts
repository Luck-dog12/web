import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { MetricsService } from './common/observability/metrics.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: MetricsService,
          useValue: { getSnapshot: () => ({}) },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return ok true', () => {
      expect(appController.health()).toEqual({ ok: true });
    });
  });
});

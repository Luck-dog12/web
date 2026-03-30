import { Injectable } from '@nestjs/common';

type MetricsSnapshot = {
  paymentSuccess: number;
  paymentFailed: number;
  playbackStarted: number;
  playbackQualitySamples: Array<{ courseId: string; variant: string; at: string }>;
  repurchaseSignals: number;
  retentionSignals: number;
  clientEvents: Array<{ name: string; at: string; courseId?: string }>;
};

@Injectable()
export class MetricsService {
  private metrics: MetricsSnapshot = {
    paymentSuccess: 0,
    paymentFailed: 0,
    playbackStarted: 0,
    playbackQualitySamples: [],
    repurchaseSignals: 0,
    retentionSignals: 0,
    clientEvents: [],
  };

  trackPaymentSuccess() {
    this.metrics.paymentSuccess += 1;
  }

  trackPaymentFailure() {
    this.metrics.paymentFailed += 1;
  }

  trackPlaybackStart(courseId: string) {
    this.metrics.playbackStarted += 1;
    this.metrics.playbackQualitySamples.push({
      courseId,
      variant: 'started',
      at: new Date().toISOString(),
    });
  }

  trackPlaybackQuality(courseId: string, variant: string) {
    this.metrics.playbackQualitySamples.push({
      courseId,
      variant,
      at: new Date().toISOString(),
    });
  }

  trackRepurchaseSignal() {
    this.metrics.repurchaseSignals += 1;
  }

  trackClientEvent(name: string, courseId?: string) {
    if (name === 'repurchase') this.metrics.repurchaseSignals += 1;
    if (name === 'retention') this.metrics.retentionSignals += 1;
    this.metrics.clientEvents.push({
      name,
      at: new Date().toISOString(),
      courseId,
    });
  }

  getSnapshot() {
    return {
      ...this.metrics,
      playbackQualitySamples: [...this.metrics.playbackQualitySamples],
      clientEvents: [...this.metrics.clientEvents],
    };
  }
}

import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { parse as parseDotenv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

export type StreamPlaybackPolicy = 'public' | 'signed';
export type StreamPlaybackVariant = 'hls' | 'dash' | 'iframe';

type CloudflareApiEnvelope<T> = {
  success: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result: T;
};

type CloudflareStreamStatus = {
  state?: string;
};

type CloudflareStreamVideoResult = {
  uid: string;
  readyToStream?: boolean;
  duration?: number;
  thumbnail?: string | null;
  status?: CloudflareStreamStatus;
};

type DirectUploadResult = {
  uid: string;
  uploadURL: string;
};

type StreamTokenResult = {
  token: string;
};

const DEFAULT_MAX_UPLOAD_DURATION_SECONDS = 2 * 60 * 60;

@Injectable()
export class CloudflareStreamService {
  private envFileValues?: Map<string, string>;

  private buildEnvCandidates(baseDir: string) {
    const candidates: string[] = [];
    let current = path.resolve(baseDir);

    while (true) {
      candidates.push(path.join(current, '.env'));
      candidates.push(path.join(current, 'apps/api/.env'));

      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }

    return candidates;
  }

  private getEnvValue(name: string) {
    const direct = process.env[name]?.trim();
    if (direct) return direct;

    const fileValue = this.getEnvFileValues().get(name)?.trim();
    return fileValue || undefined;
  }

  private getEnvFileValues() {
    if (this.envFileValues) return this.envFileValues;

    const initCwd = process.env.INIT_CWD;
    const envCandidates = Array.from(
      new Set([
        ...this.buildEnvCandidates(process.cwd()),
        ...this.buildEnvCandidates(__dirname),
        ...(initCwd ? this.buildEnvCandidates(initCwd) : []),
      ]),
    );
    const mergedValues = new Map<string, string>();

    for (const envPath of envCandidates) {
      if (!fs.existsSync(envPath)) continue;
      const parsed = parseDotenv(fs.readFileSync(envPath, 'utf8'));
      for (const [key, value] of Object.entries(parsed)) {
        if (!mergedValues.has(key)) {
          mergedValues.set(key, String(value));
        }
      }
    }

    this.envFileValues = mergedValues;

    return this.envFileValues;
  }

  isConfigured() {
    return Boolean(
      this.getEnvValue('CF_STREAM_ACCOUNT_ID') &&
        this.getEnvValue('CF_STREAM_API_TOKEN') &&
        this.getEnvValue('CF_STREAM_CUSTOMER_CODE'),
    );
  }

  normalizePlaybackPolicy(
    value: string | null | undefined,
  ): StreamPlaybackPolicy {
    return value === 'public' ? 'public' : 'signed';
  }

  async createDirectUpload(options?: { durationSeconds?: number | null }) {
    this.assertConfigured();

    const maxDurationSeconds = Math.max(
      options?.durationSeconds ?? DEFAULT_MAX_UPLOAD_DURATION_SECONDS,
      60,
    );

    const result = await this.request<DirectUploadResult>(
      'POST',
      '/stream/direct_upload',
      { maxDurationSeconds },
    );
    return { uid: result.uid, uploadUrl: result.uploadURL };
  }

  async copyFromUrl(url: string) {
    this.assertConfigured();

    const result = await this.request<CloudflareStreamVideoResult>(
      'POST',
      '/stream/copy',
      { url },
    );
    return this.normalizeVideo(result);
  }

  async configureVideo(videoId: string, playbackPolicy: StreamPlaybackPolicy) {
    this.assertConfigured();

    const allowedOrigins = this.getAllowedOrigins();
    await this.request(
      'POST',
      `/stream/${encodeURIComponent(videoId)}`,
      {
        uid: videoId,
        requireSignedURLs: playbackPolicy === 'signed',
        ...(allowedOrigins.length > 0 ? { allowedOrigins } : {}),
      },
    );
  }

  async getVideo(videoId: string) {
    this.assertConfigured();
    const result = await this.request<CloudflareStreamVideoResult>(
      'GET',
      `/stream/${encodeURIComponent(videoId)}`,
    );
    return this.normalizeVideo(result);
  }

  async buildPlaybackUrl(options: {
    videoId: string;
    variant: StreamPlaybackVariant;
    playbackPolicy: StreamPlaybackPolicy;
    blockedCountries?: string[];
  }) {
    this.assertConfigured();

    const assetId =
      options.playbackPolicy === 'signed'
        ? await this.createSignedToken(
            options.videoId,
            options.blockedCountries ?? [],
          )
        : options.videoId;

    const customerCode = this.getEnvValue('CF_STREAM_CUSTOMER_CODE')!;

    if (options.variant === 'iframe') {
      return `https://${customerCode}.cloudflarestream.com/${assetId}/iframe`;
    }

    if (options.variant === 'dash') {
      return `https://${customerCode}.cloudflarestream.com/${assetId}/manifest/video.mpd`;
    }

    return `https://${customerCode}.cloudflarestream.com/${assetId}/manifest/video.m3u8`;
  }

  private normalizeVideo(result: CloudflareStreamVideoResult) {
    return {
      uid: result.uid,
      readyToStream: Boolean(result.readyToStream),
      durationSeconds:
        typeof result.duration === 'number' && Number.isFinite(result.duration)
          ? Math.max(1, Math.round(result.duration))
          : null,
      thumbnailUrl: result.thumbnail ?? null,
      status:
        result.status?.state ??
        (result.readyToStream ? 'ready' : 'processing'),
    };
  }

  private assertConfigured() {
    if (this.isConfigured()) return;
    throw new ServiceUnavailableException(
      'Cloudflare Stream is not configured. Set CF_STREAM_ACCOUNT_ID, CF_STREAM_API_TOKEN, and CF_STREAM_CUSTOMER_CODE.',
    );
  }

  private getAllowedOrigins() {
    const candidates = [
      ...(process.env.WEB_BASE_URLS ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      process.env.WEB_BASE_URL ?? '',
    ];

    return Array.from(
      new Set(
        candidates
          .map((value) => {
            try {
              return new URL(value).host;
            } catch {
              return '';
            }
          })
          .filter(Boolean),
      ),
    );
  }

  private async createSignedToken(
    videoId: string,
    blockedCountries: string[],
  ) {
    const accessRules =
      blockedCountries.length > 0
        ? [
            {
              type: 'ip.geoip.country',
              action: 'block',
              country: Array.from(new Set(blockedCountries)),
            },
          ]
        : undefined;

    const result = await this.request<StreamTokenResult>(
      'POST',
      `/stream/${encodeURIComponent(videoId)}/token`,
      {
        exp: Math.floor(Date.now() / 1000) + 15 * 60,
        ...(accessRules ? { accessRules } : {}),
      },
    );

    return result.token;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ) {
    const accountId = this.getEnvValue('CF_STREAM_ACCOUNT_ID')!;
    const apiToken = this.getEnvValue('CF_STREAM_API_TOKEN')!;
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${apiToken}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );

    const payload = (await response.json().catch(() => undefined)) as
      | CloudflareApiEnvelope<T>
      | undefined;

    if (response.ok && payload?.success) {
      return payload.result;
    }

    const errorMessage =
      payload?.errors?.map((item) => item.message).filter(Boolean).join('; ') ||
      `Cloudflare Stream API request failed with status ${response.status}`;

    throw new BadGatewayException(errorMessage);
  }
}

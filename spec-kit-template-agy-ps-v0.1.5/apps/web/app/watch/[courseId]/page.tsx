'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PlaybackSourceResponse, apiGet, apiPost } from '../../../lib/api';

export default function WatchPage() {
  const router = useRouter();
  const params = useParams<{ courseId: string }>();
  const courseId = useMemo(() => params.courseId, [params.courseId]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const retentionTracked = useRef(false);

  const [playback, setPlayback] = useState<PlaybackSourceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    let canceled = false;

    async function load() {
      setError(null);

      try {
        const res = await apiGet<PlaybackSourceResponse>(
          `/playback/source/${courseId}`,
          {
            credentials: 'include',
          },
        );

        if (!canceled) {
          setPlayback(res);
        }
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : 'Failed to load playback';
        if (!canceled) setError(message);
        if (message.includes('Unauthorized')) {
          router.replace(`/login?next=${encodeURIComponent(`/watch/${courseId}`)}`);
        }
      }
    }

    void load();
    return () => {
      canceled = true;
    };
  }, [courseId, router]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    element.playbackRate = rate;
    element.volume = volume;
  }, [rate, volume]);

  function getPreferredSource() {
    const element = videoRef.current;
    if (playback?.hlsUrl && element?.canPlayType('application/vnd.apple.mpegurl')) {
      return playback.hlsUrl;
    }
    if (playback?.dashUrl && element?.canPlayType('application/dash+xml')) {
      return playback.dashUrl;
    }
    return playback?.hlsUrl ?? playback?.dashUrl ?? null;
  }

  function seekTo(next: number) {
    const element = videoRef.current;
    if (!element || !Number.isFinite(next)) return;
    element.currentTime = next;
    setCurrentTime(next);
  }

  async function toggleFullscreen() {
    const element = videoRef.current;
    if (!element) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await element.requestFullscreen();
  }

  async function track(name: string) {
    await apiPost('/metrics/event', { name, courseId }).catch(() => undefined);
  }

  const preferredSource = getPreferredSource();
  const isStreamIframe = Boolean(playback?.iframeUrl);

  return (
    <div className="min-h-screen bg-[var(--bg-base)] px-6 py-8 text-[var(--text-primary)]">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between border-b border-[var(--border-soft)] pb-4">
          <Link
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            href={`/courses/${courseId}`}
          >
            Back to course
          </Link>
          <Link
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            href="/"
          >
            Home
          </Link>
        </div>

        <div className="glass-shell mt-6 p-4">
          {error ? (
            <div className="text-sm text-[var(--danger)]">{error}</div>
          ) : null}

          {isStreamIframe && playback?.iframeUrl ? (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-xl border border-[var(--border-soft)] bg-black">
                <iframe
                  src={playback.iframeUrl}
                  className="aspect-video w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  title="Cloudflare Stream player"
                  onLoad={() => {
                    void track('playback_quality');
                  }}
                />
              </div>
              <div className="text-sm text-[var(--text-secondary)]">
                Cloudflare Stream is serving this lesson. Playback controls are
                handled by the embedded player.
              </div>
            </div>
          ) : preferredSource ? (
            <div>
              <video
                ref={videoRef}
                className="w-full rounded-xl border border-[var(--border-soft)] bg-black"
                controls
                preload="metadata"
                src={preferredSource}
                poster={playback?.thumbnailUrl ?? undefined}
                onLoadedMetadata={(event) => {
                  setDuration(event.currentTarget.duration || 0);
                  void track('playback_quality');
                }}
                onTimeUpdate={(event) => {
                  const next = event.currentTarget.currentTime || 0;
                  setCurrentTime(next);
                  if (!retentionTracked.current && next > 30) {
                    retentionTracked.current = true;
                    void track('retention');
                  }
                }}
              />
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  Progress
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={1}
                    value={Math.min(currentTime, duration || 0)}
                    onChange={(event) => seekTo(Number(event.target.value))}
                  />
                </label>
                <label className="flex items-center gap-2">
                  Speed
                  <select
                    value={rate}
                    onChange={(event) => setRate(Number(event.target.value))}
                    className="field-input rounded px-2 py-1"
                  >
                    <option value={0.75}>0.75x</option>
                    <option value={1}>1x</option>
                    <option value={1.25}>1.25x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2}>2x</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  Volume
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volume}
                    onChange={(event) => setVolume(Number(event.target.value))}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void toggleFullscreen()}
                  className="action-ghost px-3 py-1"
                >
                  Fullscreen
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-[var(--text-secondary)]">
              Loading playback...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

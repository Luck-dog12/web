'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiGet, apiPost } from '../../../lib/api';

export default function WatchPage() {
  const router = useRouter();
  const params = useParams<{ courseId: string }>();
  const courseId = useMemo(() => params.courseId, [params.courseId]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [hlsUrl, setHlsUrl] = useState<string | null>(null);
  const [dashUrl, setDashUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const retentionTracked = useRef(false);

  useEffect(() => {
    let canceled = false;
    async function load() {
      setError(null);
      try {
        const res = await apiGet<{ sourceUrl: string; hlsUrl: string | null; dashUrl: string | null }>(
          `/playback/source/${courseId}`,
          {
          credentials: 'include',
          },
        );
        if (!canceled) {
          setSourceUrl(res.sourceUrl);
          setHlsUrl(res.hlsUrl);
          setDashUrl(res.dashUrl);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : '加载失败';
        if (!canceled) setError(msg);
        if (msg.includes('Unauthorized')) {
          router.replace(`/login?next=${encodeURIComponent(`/watch/${courseId}`)}`);
          return;
        }
      }
    }
    void load();
    return () => {
      canceled = true;
    };
  }, [courseId, router]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.playbackRate = rate;
    el.volume = volume;
  }, [rate, volume]);

  function getPreferredSource() {
    const el = videoRef.current;
    if (hlsUrl && el?.canPlayType('application/vnd.apple.mpegurl')) return hlsUrl;
    if (dashUrl && el?.canPlayType('application/dash+xml')) return dashUrl;
    return sourceUrl;
  }

  function seekTo(next: number) {
    const el = videoRef.current;
    if (!el || !Number.isFinite(next)) return;
    el.currentTime = next;
    setCurrentTime(next);
  }

  async function toggleFullscreen() {
    const el = videoRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await el.requestFullscreen();
  }

  async function track(name: string) {
    await apiPost('/metrics/event', { name, courseId }).catch(() => undefined);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] px-6 py-8 text-[var(--text-primary)]">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between border-b border-[var(--border-soft)] pb-4">
          <Link className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]" href={`/courses/${courseId}`}>
            返回课程
          </Link>
          <Link className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]" href="/">
            首页
          </Link>
        </div>

        <div className="glass-shell mt-6 p-4">
          {error ? <div className="text-sm text-[var(--danger)]">{error}</div> : null}
          {sourceUrl ? (
            <div>
              <video
                ref={videoRef}
                className="w-full rounded-xl border border-[var(--border-soft)] bg-black"
                controls
                preload="metadata"
                src={getPreferredSource() ?? undefined}
                onLoadedMetadata={(e) => {
                  setDuration(e.currentTarget.duration || 0);
                  void track('playback_quality');
                }}
                onTimeUpdate={(e) => {
                  const next = e.currentTarget.currentTime || 0;
                  setCurrentTime(next);
                  if (!retentionTracked.current && next > 30) {
                    retentionTracked.current = true;
                    void track('retention');
                  }
                }}
              />
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  进度
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={1}
                    value={Math.min(currentTime, duration || 0)}
                    onChange={(e) => seekTo(Number(e.target.value))}
                  />
                </label>
                <label className="flex items-center gap-2">
                  倍速
                  <select
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
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
                  音量
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                  />
                </label>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="action-ghost px-3 py-1"
                >
                  全屏
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-[var(--text-secondary)]">加载中…</div>
          )}
        </div>
      </div>
    </div>
  );
}


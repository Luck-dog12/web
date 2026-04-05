'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  AdminCourse,
  VideoPlaybackPolicy,
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
} from '../../../lib/api';

function parseDurationSeconds(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
}

function inferTitleFromFile(file: File | null) {
  if (!file) return '';
  return file.name.replace(/\.[^.]+$/, '');
}

function getVideoStatus(video: AdminCourse['videos'][number]) {
  if (video.cfStreamVideoId) {
    if (video.streamReadyToStream) return 'Ready to play';
    return video.streamStatus ?? 'Processing in Stream';
  }

  return 'Awaiting Stream asset';
}

export default function AdminCoursePage() {
  const router = useRouter();
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId;

  const [course, setCourse] = useState<AdminCourse | null>(null);
  const [title, setTitle] = useState('');
  const [existingStreamId, setExistingStreamId] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [duration, setDuration] = useState('300');
  const [playbackPolicy, setPlaybackPolicy] =
    useState<VideoPlaybackPolicy>('signed');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [syncingVideoId, setSyncingVideoId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const me = await apiGet<{ isAdmin: boolean }>('/auth/me', {
      credentials: 'include',
    });
    if (!me.isAdmin) {
      router.replace('/console');
      return;
    }

    const res = await apiGet<{ courses: AdminCourse[] }>('/admin-content/courses', {
      credentials: 'include',
    });
    const found = res.courses.find((item) => item.id === courseId) ?? null;
    setCourse(found);
  }

  useEffect(() => {
    void load().catch((cause) => {
      const message =
        cause instanceof Error ? cause.message : 'Failed to load admin data';
      setError(message);
      if (message.includes('Unauthorized')) {
        router.replace(`/login?next=/admin/${courseId}`);
      }
    });
  }, [courseId, router]);

  function resetVideoInputs() {
    setTitle('');
    setExistingStreamId('');
    setImportUrl('');
    setSelectedFile(null);
  }

  function requireTitle() {
    const nextTitle = title.trim();
    if (nextTitle) return nextTitle;

    const fileTitle = inferTitleFromFile(selectedFile);
    if (fileTitle) {
      setTitle(fileTitle);
      return fileTitle;
    }

    throw new Error('Title is required');
  }

  async function createVideo(payload: Record<string, unknown>, action: string) {
    if (!course) return;

    setError(null);
    setBusyAction(action);
    try {
      await apiPost(`/admin-content/courses/${course.id}/videos`, payload, {
        credentials: 'include',
      });
      resetVideoInputs();
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Failed to create video record',
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function addExistingStreamVideo() {
    const nextTitle = requireTitle();
    const streamId = existingStreamId.trim();

    if (!streamId) {
      setError('Stream ID is required');
      return;
    }

    await createVideo(
      {
        title: nextTitle,
        cfStreamVideoId: streamId,
        durationSeconds: parseDurationSeconds(duration),
        playbackPolicy,
      },
      'stream-id',
    );
  }

  async function importVideoToStream() {
    const nextTitle = requireTitle();
    const nextImportUrl = importUrl.trim();

    if (!nextImportUrl) {
      setError('Import URL is required');
      return;
    }

    await createVideo(
      {
        title: nextTitle,
        importUrl: nextImportUrl,
        durationSeconds: parseDurationSeconds(duration),
        playbackPolicy,
      },
      'import-url',
    );
  }

  async function uploadFileToStream() {
    if (!course) return;

    const file = selectedFile;
    if (!file) {
      setError('Choose a local file first');
      return;
    }

    const nextTitle = requireTitle();
    setError(null);
    setBusyAction('upload-file');

    try {
      const created = await apiPost<{
        video: { id: string; cfStreamVideoId: string | null };
        uploadUrl: string;
      }>(
        `/admin-content/courses/${course.id}/videos/direct-upload`,
        {
          title: nextTitle,
          durationSeconds: parseDurationSeconds(duration),
          playbackPolicy,
        },
        { credentials: 'include' },
      );

      const formData = new FormData();
      formData.set('file', file, file.name);
      const uploadRes = await fetch(created.uploadUrl, {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error('Upload to Cloudflare Stream failed');
      }

      await apiPost(
        `/admin-content/videos/${created.video.id}/sync-stream`,
        undefined,
        { credentials: 'include' },
      ).catch(() => undefined);

      resetVideoInputs();
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Failed to upload file to Cloudflare Stream',
      );
    } finally {
      setBusyAction(null);
    }
  }

  function openRename(videoId: string, currentTitle: string) {
    setRenamingId(videoId);
    setRenamingTitle(currentTitle);
    setDeletingVideoId(null);
  }

  function closeRename() {
    setRenamingId(null);
    setRenamingTitle('');
  }

  function openDeleteVideo(videoId: string) {
    setDeletingVideoId(videoId);
    setRenamingId(null);
    setRenamingTitle('');
  }

  function closeDeleteVideo() {
    setDeletingVideoId(null);
  }

  async function submitRename() {
    if (!renamingId) return;

    const nextTitle = renamingTitle.trim();
    if (!nextTitle) {
      setError('Video title cannot be empty');
      return;
    }

    setError(null);
    setRenaming(true);
    try {
      await apiPatch(
        `/admin-content/videos/${renamingId}`,
        { title: nextTitle },
        { credentials: 'include' },
      );
      await load();
      closeRename();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Failed to rename video',
      );
    } finally {
      setRenaming(false);
    }
  }

  async function confirmDeleteVideo() {
    if (!deletingVideoId) return;

    setError(null);
    setDeleting(true);
    try {
      await apiDelete(`/admin-content/videos/${deletingVideoId}`, {
        credentials: 'include',
      });
      closeDeleteVideo();
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Failed to delete video',
      );
    } finally {
      setDeleting(false);
    }
  }

  async function syncVideo(videoId: string) {
    setError(null);
    setSyncingVideoId(videoId);
    try {
      await apiPost(`/admin-content/videos/${videoId}/sync-stream`, undefined, {
        credentials: 'include',
      });
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Failed to sync Stream status',
      );
    } finally {
      setSyncingVideoId(null);
    }
  }

  async function logout() {
    await apiPost('/auth/logout', undefined, { credentials: 'include' }).catch(() => undefined);
    router.replace('/');
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] px-6 py-10 text-[var(--text-primary)]">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-4">
          <h1 className="brand-title text-4xl font-semibold">
            Course Content
          </h1>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Back to admin
            </Link>
            <button
              type="button"
              className="action-primary px-3 py-2 text-sm font-medium"
              onClick={() => void logout()}
            >
              Logout
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-[var(--danger)] bg-[rgba(200,122,122,0.12)] p-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}

        {course ? (
          <div className="glass-shell p-4">
            <div className="brand-title text-3xl font-semibold">
              {course.title}
            </div>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Stream-first workflow: attach an existing Stream video, import from
              a remote URL, or upload a local file directly to Cloudflare
              Stream.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                className="field-input px-3 py-2 text-sm"
                placeholder="Video title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <input
                className="field-input px-3 py-2 text-sm"
                placeholder="Duration (seconds)"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              />
              <input
                className="field-input px-3 py-2 text-sm"
                placeholder="Existing Cloudflare Stream ID"
                value={existingStreamId}
                onChange={(event) => setExistingStreamId(event.target.value)}
              />
              <select
                value={playbackPolicy}
                onChange={(event) =>
                  setPlaybackPolicy(event.target.value as VideoPlaybackPolicy)
                }
                className="field-input px-3 py-2 text-sm"
              >
                <option value="signed">Signed playback</option>
                <option value="public">Public playback</option>
              </select>
              <input
                className="field-input px-3 py-2 text-sm sm:col-span-2"
                placeholder="Remote source video URL (not Stream manifest / iframe URL)"
                value={importUrl}
                onChange={(event) => setImportUrl(event.target.value)}
              />
              <input
                className="field-input px-3 py-2 text-sm sm:col-span-2"
                type="file"
                accept="video/*"
                onChange={(event) =>
                  setSelectedFile(event.target.files?.[0] ?? null)
                }
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="action-primary px-3 py-2 text-sm font-medium"
                onClick={() => void addExistingStreamVideo()}
                disabled={busyAction !== null}
              >
                {busyAction === 'stream-id'
                  ? 'Saving...'
                  : 'Attach Stream ID'}
              </button>
              <button
                type="button"
                className="action-ghost px-3 py-2 text-sm"
                onClick={() => void importVideoToStream()}
                disabled={busyAction !== null}
              >
                {busyAction === 'import-url'
                  ? 'Importing...'
                  : 'Import URL to Stream'}
              </button>
              <button
                type="button"
                className="action-ghost px-3 py-2 text-sm"
                onClick={() => void uploadFileToStream()}
                disabled={busyAction !== null}
              >
                {busyAction === 'upload-file'
                  ? 'Uploading...'
                  : 'Upload Local File'}
              </button>
            </div>

            <div className="mt-2 text-xs text-[var(--text-muted)]">
              Direct browser uploads use Cloudflare Stream direct upload. Keep
              files under the basic upload limit for this flow.
            </div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">
              Import URL expects the original downloadable video file. Playback
              URLs like <code>video.mpd</code>, <code>video.m3u8</code>, or
              <code>/iframe</code> from Cloudflare Stream cannot be imported.
            </div>

            <div className="mt-6 space-y-3">
              {course.videos.map((video) => (
                <div key={video.id} className="section-shell px-3 py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">{video.title}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        Status: {getVideoStatus(video)}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        Playback: {video.playbackPolicy}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] break-all">
                        {video.cfStreamVideoId
                          ? `Stream ID: ${video.cfStreamVideoId}`
                          : 'No Stream ID configured'}
                      </div>
                    </div>

                    {renamingId === video.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="action-ghost px-2 py-1 text-xs"
                          onClick={closeRename}
                          disabled={renaming}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="action-primary px-2 py-1 text-xs font-medium"
                          onClick={() => void submitRename()}
                          disabled={renaming}
                        >
                          {renaming ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    ) : deletingVideoId === video.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="action-ghost px-2 py-1 text-xs"
                          onClick={closeDeleteVideo}
                          disabled={deleting}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="action-primary px-2 py-1 text-xs font-medium"
                          onClick={() => void confirmDeleteVideo()}
                          disabled={deleting}
                        >
                          {deleting ? 'Deleting...' : 'Confirm delete'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {video.cfStreamVideoId ? (
                          <button
                            type="button"
                            onClick={() => void syncVideo(video.id)}
                            className="action-ghost px-2 py-1 text-xs"
                            disabled={syncingVideoId === video.id}
                          >
                            {syncingVideoId === video.id
                              ? 'Syncing...'
                              : 'Sync Stream'}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => openRename(video.id, video.title)}
                          className="action-ghost px-2 py-1 text-xs"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeleteVideo(video.id)}
                          className="action-ghost px-2 py-1 text-xs text-[var(--danger)]"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  {renamingId === video.id ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                      <input
                        className="field-input w-full px-3 py-2 text-sm"
                        value={renamingTitle}
                        onChange={(event) =>
                          setRenamingTitle(event.target.value)
                        }
                        placeholder="New video title"
                        autoFocus
                      />
                      <div className="text-xs text-[var(--text-muted)]">
                        Press save to rename this lesson.
                      </div>
                    </div>
                  ) : null}

                  {deletingVideoId === video.id ? (
                    <div className="mt-3 text-xs text-[var(--text-secondary)]">
                      This removes the local catalog record only. Stream asset
                      cleanup can be handled separately if needed.
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-sm text-[var(--text-secondary)]">
            Course not found.
          </div>
        )}
      </div>
    </div>
  );
}

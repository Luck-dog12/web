'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminCourse, apiDelete, apiGet, apiPatch, apiPost } from '../../../lib/api';

export default function AdminCoursePage() {
  const router = useRouter();
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId;
  const [course, setCourse] = useState<AdminCourse | null>(null);
  const [title, setTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [duration, setDuration] = useState('300');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const me = await apiGet<{ isAdmin: boolean }>('/auth/me', { credentials: 'include' });
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
    void load().catch((e) => {
      const msg = e instanceof Error ? e.message : '加载失败';
      setError(msg);
      if (msg.includes('Unauthorized')) router.replace(`/login?next=/admin/${courseId}`);
    });
  }, [courseId, router]);

  async function addVideo() {
    if (!course) return;
    setError(null);
    try {
      await apiPost(
        `/admin-content/courses/${course.id}/videos`,
        {
          title,
          sourceUrl,
          durationSeconds: Number(duration),
        },
        { credentials: 'include' },
      );
      setTitle('');
      setSourceUrl('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '新增视频失败');
    }
  }

  function openRename(videoId: string, currentTitle: string) {
    setRenamingId(videoId);
    setRenamingTitle(currentTitle);
  }

  function closeRename() {
    setRenamingId(null);
    setRenamingTitle('');
  }

  function openDeleteVideo(videoId: string, currentTitle: string) {
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
    if (!nextTitle) return;
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
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新视频失败');
    } finally {
      setRenaming(false);
    }
  }

  async function confirmDeleteVideo() {
    if (!deletingVideoId) return;
    setError(null);
    setDeleting(true);
    try {
      await apiDelete(`/admin-content/videos/${deletingVideoId}`, { credentials: 'include' });
      closeDeleteVideo();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除视频失败');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] px-6 py-10 text-[var(--text-primary)]">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-4">
          <h1 className="brand-title text-4xl font-semibold">课程内容维护</h1>
          <Link href="/admin" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            返回管理页
          </Link>
        </div>
        {error ? <div className="rounded-lg border border-[var(--danger)] bg-[rgba(200,122,122,0.12)] p-3 text-sm text-[var(--danger)]">{error}</div> : null}
        {course ? (
          <div className="glass-shell p-4">
            <div className="brand-title text-3xl font-semibold">{course.title}</div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                className="field-input px-3 py-2 text-sm"
                placeholder="视频标题"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <input
                className="field-input px-3 py-2 text-sm"
                placeholder="视频地址"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
              />
              <input
                className="field-input px-3 py-2 text-sm"
                placeholder="时长秒"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="action-primary mt-3 px-3 py-2 text-sm font-medium"
              onClick={addVideo}
            >
              添加视频
            </button>
            <div className="mt-4 space-y-2">
              {course.videos.map((video) => (
                <div key={video.id} className="section-shell px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{video.title}</div>
                      <div className="text-xs text-[var(--text-muted)]">{video.sourceUrl}</div>
                    </div>
                    {renamingId === video.id ? (
                      <div className="flex items-center gap-2">
                        <button type="button" className="action-ghost px-2 py-1 text-xs" onClick={closeRename} disabled={renaming}>
                          取消
                        </button>
                        <button type="button" className="action-primary px-2 py-1 text-xs font-medium" onClick={submitRename} disabled={renaming}>
                          {renaming ? '保存中…' : '保存'}
                        </button>
                      </div>
                    ) : deletingVideoId === video.id ? (
                      <div className="flex items-center gap-2">
                        <button type="button" className="action-ghost px-2 py-1 text-xs" onClick={closeDeleteVideo} disabled={deleting}>
                          取消
                        </button>
                        <button
                          type="button"
                          className="action-primary px-2 py-1 text-xs font-medium"
                          onClick={() => void confirmDeleteVideo()}
                          disabled={deleting}
                        >
                          {deleting ? '删除中…' : '确认删除'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingVideoId(null);
                            setDeleting(false);
                            openRename(video.id, video.title);
                          }}
                          className="action-ghost px-2 py-1 text-xs"
                        >
                          重命名
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeleteVideo(video.id, video.title)}
                          className="action-ghost px-2 py-1 text-xs text-[var(--danger)]"
                        >
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                  {renamingId === video.id ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                      <input
                        className="field-input w-full px-3 py-2 text-sm"
                        value={renamingTitle}
                        onChange={(e) => setRenamingTitle(e.target.value)}
                        placeholder="请输入新标题"
                        autoFocus
                      />
                      <div className="text-xs text-[var(--text-muted)]">回车保存或点击保存</div>
                    </div>
                  ) : null}
                  {deletingVideoId === video.id ? (
                    <div className="mt-3 text-xs text-[var(--text-secondary)]">将删除该视频。该操作不可撤销。</div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-sm text-[var(--text-secondary)]">课程不存在</div>
        )}
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminCourse, apiDelete, apiGet, apiPatch, apiPost, formatPrice } from '../../lib/api';

type MePayload = {
  user: { id: string; email: string; createdAt: string } | null;
  isAdmin: boolean;
};

type OrdersPayload = {
  orders: Array<{
    id: string;
    status: string;
    amountCents: number;
    currency: string;
    createdAt: string;
    course: { id: string; title: string };
  }>;
};

type Locale = 'zh-CN' | 'en-US';

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'content' | 'profile' | 'orders' | 'settings'>('content');
  const [me, setMe] = useState<MePayload | null>(null);
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [orders, setOrders] = useState<OrdersPayload['orders']>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('1999');
  const [currency, setCurrency] = useState<'USD' | 'EUR'>('USD');
  const [ready, setReady] = useState(false);
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [locale, setLocale] = useState<Locale>('zh-CN');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  async function load() {
    const meRes = await apiGet<MePayload>('/auth/me', { credentials: 'include' });
    if (!meRes.isAdmin) {
      router.replace('/console');
      return;
    }
    const [coursesRes, ordersRes] = await Promise.all([
      apiGet<{ courses: AdminCourse[] }>('/admin-content/courses', { credentials: 'include' }),
      apiGet<OrdersPayload>('/payment/orders', { credentials: 'include' }),
    ]);
    setMe(meRes);
    setCourses(coursesRes.courses);
    setOrders(ordersRes.orders);
    setReady(true);

    const key = `console-settings:${meRes.user?.id ?? 'guest'}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as { displayName?: string; locale?: Locale };
      setDisplayName(parsed.displayName ?? meRes.user?.email?.split('@')[0] ?? '');
      setLocale(parsed.locale ?? 'zh-CN');
    } else {
      setDisplayName(meRes.user?.email?.split('@')[0] ?? '');
    }
  }

  useEffect(() => {
    void load().catch((e) => {
      const msg = e instanceof Error ? e.message : '加载失败';
      setError(msg);
      if (msg.includes('Unauthorized')) router.replace('/login?next=/admin');
    });
  }, [router]);

  async function createCourse() {
    setError(null);
    try {
      await apiPost(
        '/admin-content/courses',
        {
          title,
          description,
          currency,
          priceCents: Number(price),
          priceCentsUsd: currency === 'USD' ? Number(price) : undefined,
          priceCentsEur: currency === 'EUR' ? Number(price) : undefined,
        },
        { credentials: 'include' },
      );
      setTitle('');
      setDescription('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败');
    }
  }

  function getStatusLabel(status: string) {
    if (locale === 'zh-CN') {
      if (status === 'paid') return '已支付';
      if (status === 'pending') return '待支付';
      if (status === 'failed') return '失败';
      if (status === 'canceled') return '已取消';
      return status;
    }
    return status;
  }

  async function togglePublished(course: AdminCourse) {
    setError(null);
    try {
      await apiPatch(
        `/admin-content/courses/${course.id}`,
        { isPublished: !course.isPublished },
        { credentials: 'include' },
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新失败');
    }
  }

  function saveSettings() {
    const key = `console-settings:${me?.user?.id ?? 'guest'}`;
    localStorage.setItem(key, JSON.stringify({ displayName, locale }));
    document.cookie = `console_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setSaveMessage('设置已保存');
  }

  async function logout() {
    await apiPost('/auth/logout', undefined, { credentials: 'include' }).catch(() => undefined);
    router.replace('/');
  }

  function openDeleteCourse(course: AdminCourse) {
    setDeletingCourseId(course.id);
  }

  function closeDeleteCourse() {
    setDeletingCourseId(null);
  }

  async function confirmDeleteCourse() {
    if (!deletingCourseId) return;
    setError(null);
    setDeleting(true);
    try {
      await apiDelete(`/admin-content/courses/${deletingCourseId}`, { credentials: 'include' });
      closeDeleteCourse();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  }

  const totalCourses = courses.length;
  const publishedCourses = courses.filter((c) => c.isPublished).length;
  const totalVideos = courses.reduce((sum, c) => sum + (c.videos?.length ?? 0), 0);

  return (
    <div className="min-h-screen bg-[var(--bg-base)] px-6 py-10 text-[var(--text-primary)]">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-4">
          <div>
            <h1 className="brand-title text-4xl font-semibold">内容管理</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <div className="status-pill">管理员</div>
              <div className="status-pill">课程 {totalCourses}</div>
              <div className="status-pill">已上架 {publishedCourses}</div>
              <div className="status-pill">视频 {totalVideos}</div>
            </div>
          </div>
          <Link href="/" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            返回首页
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`px-3 py-2 text-sm ${activeTab === 'content' ? 'action-primary' : 'action-ghost'}`}
            onClick={() => setActiveTab('content')}
          >
            课程与视频
          </button>
          <button
            type="button"
            className={`px-3 py-2 text-sm ${activeTab === 'profile' ? 'action-primary' : 'action-ghost'}`}
            onClick={() => setActiveTab('profile')}
          >
            账户信息
          </button>
          <button
            type="button"
            className={`px-3 py-2 text-sm ${activeTab === 'orders' ? 'action-primary' : 'action-ghost'}`}
            onClick={() => setActiveTab('orders')}
          >
            订单记录
          </button>
          <button
            type="button"
            className={`px-3 py-2 text-sm ${activeTab === 'settings' ? 'action-primary' : 'action-ghost'}`}
            onClick={() => setActiveTab('settings')}
          >
            偏好设置
          </button>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            className="action-primary px-3 py-2 text-sm font-medium"
            onClick={() => void logout()}
          >
            Logout
          </button>
        </div>
        {error ? <div className="rounded-lg border border-[var(--danger)] bg-[rgba(200,122,122,0.12)] p-3 text-sm text-[var(--danger)]">{error}</div> : null}
        {activeTab === 'content' ? (
          <>
            <div className="glass-shell p-4">
              <div className="subtle-label">新建课程</div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  className="field-input px-3 py-2 text-sm"
                  placeholder="标题"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <input
                  className="field-input px-3 py-2 text-sm"
                  placeholder="描述"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <input
                  className="field-input px-3 py-2 text-sm"
                  placeholder="价格分"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
                <select
                  className="field-input px-3 py-2 text-sm"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as 'USD' | 'EUR')}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <button
                type="button"
                className="action-primary mt-3 px-3 py-2 text-sm font-medium"
                onClick={createCourse}
              >
                创建课程
              </button>
            </div>
            <div className="space-y-3">
              {!ready ? <div className="text-sm text-[var(--text-secondary)]">加载中…</div> : null}
              {courses.map((course) => (
                <div key={course.id} className="section-shell p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{course.title}</div>
                      <div className="text-sm text-[var(--text-secondary)]">{course.description}</div>
                      <div className="mt-2 text-xs text-[var(--text-muted)]">
                        {formatPrice(course.priceCentsUsd ?? course.priceCents, 'USD')}
                        {' / '}
                        {formatPrice(course.priceCentsEur ?? course.priceCents, 'EUR')}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="action-ghost px-3 py-2 text-xs"
                        onClick={() => void togglePublished(course)}
                        disabled={deleting && deletingCourseId === course.id}
                      >
                        {course.isPublished ? '下架' : '上架'}
                      </button>
                      {deletingCourseId === course.id ? (
                        <>
                          <button
                            type="button"
                            className="action-ghost px-3 py-2 text-xs"
                            onClick={closeDeleteCourse}
                            disabled={deleting}
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            className="action-primary px-3 py-2 text-xs font-medium"
                            onClick={() => void confirmDeleteCourse()}
                            disabled={deleting}
                          >
                            {deleting ? '删除中…' : '确认删除'}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="action-ghost px-3 py-2 text-xs text-[var(--danger)]"
                          onClick={() => openDeleteCourse(course)}
                        >
                          删除
                        </button>
                      )}
                      <Link
                        href={`/admin/${course.id}`}
                        className="action-primary px-3 py-2 text-xs font-medium"
                      >
                        维护内容
                      </Link>
                    </div>
                  </div>
                  {deletingCourseId === course.id ? (
                    <div className="mt-3 text-xs text-[var(--text-secondary)]">
                      将删除课程及其视频内容与相关记录。该操作不可撤销。
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        ) : null}
        {activeTab === 'profile' ? (
          <div className="glass-shell p-5">
            <div className="subtle-label">账户信息</div>
            <div className="mt-2 text-sm text-[var(--text-secondary)]">昵称：{displayName || '-'}</div>
            <div className="mt-1 text-sm text-[var(--text-secondary)]">邮箱：{me?.user?.email ?? '-'}</div>
            <div className="mt-1 text-sm text-[var(--text-secondary)]">用户 ID：{me?.user?.id ?? '-'}</div>
            <div className="mt-1 text-sm text-[var(--text-secondary)]">注册时间：{me?.user?.createdAt ?? '-'}</div>
          </div>
        ) : null}
        {activeTab === 'orders' ? (
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="section-shell p-4">
                <div className="brand-title text-2xl">{order.course.title}</div>
                <div className="mt-2 text-xs text-[var(--text-secondary)]">
                  状态：{getStatusLabel(order.status)} · 金额：{(order.amountCents / 100).toFixed(2)} {order.currency}
                </div>
              </div>
            ))}
            {orders.length === 0 ? <div className="text-sm text-[var(--text-secondary)]">暂无订单记录</div> : null}
          </div>
        ) : null}
        {activeTab === 'settings' ? (
          <div className="glass-shell p-5">
            <div className="subtle-label">偏好设置</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <div className="subtle-label">昵称</div>
                <input
                  className="field-input mt-1 w-full px-3 py-2 text-sm"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="请输入昵称"
                />
              </label>
              <label className="block">
                <div className="subtle-label">语言</div>
                <select
                  className="field-input mt-1 w-full px-3 py-2 text-sm"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as Locale)}
                >
                  <option value="zh-CN">简体中文</option>
                  <option value="en-US">English</option>
                </select>
              </label>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button type="button" onClick={saveSettings} className="action-primary px-4 py-2 text-sm font-medium">
                保存设置
              </button>
              {saveMessage ? <div className="text-sm text-[var(--accent-green)]">{saveMessage}</div> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

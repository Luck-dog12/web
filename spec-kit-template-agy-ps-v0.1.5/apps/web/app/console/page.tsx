'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '../../lib/api';

type MePayload = {
  user: { id: string; email: string; createdAt: string } | null;
  isAdmin: boolean;
  adminDebug?: {
    byUserId: boolean;
    byEmail: boolean;
    adminUserIdsCount: number;
    adminEmailsCount: number;
    normalizedEmail: string;
    userId: string;
  };
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

const textMap = {
  'zh-CN': {
    title: '控制台',
    adminTitle: '管理员控制台',
    roleUser: '平台用户',
    roleAdmin: '管理员',
    admin: '管理台',
    logout: '退出登录',
    profileTab: '用户信息',
    ordersTab: '已购课程',
    settingsTab: '设置',
    profileTitle: '用户信息',
    email: '邮箱',
    userId: '用户 ID',
    createdAt: '注册时间',
    noOrders: '暂无购买记录',
    status: '状态',
    amount: '金额',
    settingsTitle: '账户偏好',
    displayName: '昵称',
    displayNamePlaceholder: '请输入昵称',
    language: '语言',
    noticeTitle: '通知中心',
    courseNotice: '课程更新邮件通知',
    marketingNotice: '营销活动通知',
    securityTitle: '账户安全',
    loginEmail: '当前登录邮箱',
    recentDevice: '最近登录设备',
    passwordButton: '修改密码',
    devicesButton: '管理登录设备',
    save: '保存设置',
    saved: '设置已保存',
    passwordPanelTitle: '修改密码',
    oldPassword: '当前密码',
    newPassword: '新密码',
    confirmPassword: '确认新密码',
    passwordPlaceholder: '至少 8 位',
    submitPassword: '提交修改',
    passwordDone: '密码修改已提交',
    devicePanelTitle: '登录设备管理',
    currentDevice: '当前设备',
    revoke: '移除',
    revoked: '设备已移除',
    loading: '加载中…',
    unauthorized: '加载失败',
  },
  'en-US': {
    title: 'Console',
    adminTitle: 'Admin Console',
    roleUser: 'User',
    roleAdmin: 'Admin',
    admin: 'Admin',
    logout: 'Log out',
    profileTab: 'Profile',
    ordersTab: 'Purchases',
    settingsTab: 'Settings',
    profileTitle: 'Profile',
    email: 'Email',
    userId: 'User ID',
    createdAt: 'Created At',
    noOrders: 'No purchased courses yet',
    status: 'Status',
    amount: 'Amount',
    settingsTitle: 'Preferences',
    displayName: 'Display Name',
    displayNamePlaceholder: 'Your display name',
    language: 'Language',
    noticeTitle: 'Notifications',
    courseNotice: 'Course update emails',
    marketingNotice: 'Marketing notifications',
    securityTitle: 'Security',
    loginEmail: 'Current email',
    recentDevice: 'Recent device',
    passwordButton: 'Change password',
    devicesButton: 'Manage devices',
    save: 'Save settings',
    saved: 'Settings saved',
    passwordPanelTitle: 'Change Password',
    oldPassword: 'Current password',
    newPassword: 'New password',
    confirmPassword: 'Confirm password',
    passwordPlaceholder: 'At least 8 characters',
    submitPassword: 'Submit',
    passwordDone: 'Password update submitted',
    devicePanelTitle: 'Device Management',
    currentDevice: 'Current device',
    revoke: 'Revoke',
    revoked: 'Device revoked',
    loading: 'Loading…',
    unauthorized: 'Load failed',
  },
} as const;

export default function ConsolePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'profile' | 'orders' | 'settings'>('profile');
  const [me, setMe] = useState<MePayload | null>(null);
  const [orders, setOrders] = useState<OrdersPayload['orders']>([]);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [locale, setLocale] = useState<Locale>('zh-CN');
  const [emailNotice, setEmailNotice] = useState(true);
  const [marketingNotice, setMarketingNotice] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [deviceMessage, setDeviceMessage] = useState<string | null>(null);
  const [showPasswordPanel, setShowPasswordPanel] = useState(false);
  const [showDevicesPanel, setShowDevicesPanel] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [devices, setDevices] = useState([
    { id: 'current', name: 'Windows · Chrome', current: true },
    { id: 'iphone', name: 'iPhone · Safari', current: false },
  ]);

  const t = textMap[locale];

  useEffect(() => {
    let canceled = false;
    async function load() {
      try {
        const [meRes, ordersRes] = await Promise.all([
          apiGet<MePayload>('/auth/me', { credentials: 'include' }),
          apiGet<OrdersPayload>('/payment/orders', { credentials: 'include' }),
        ]);
        if (canceled) return;
        setMe(meRes);
        if (meRes.isAdmin) {
          router.replace('/admin');
          return;
        }
        setOrders(ordersRes.orders);
        const key = `console-settings:${meRes.user?.id ?? 'guest'}`;
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            displayName?: string;
            locale?: Locale;
            emailNotice?: boolean;
            marketingNotice?: boolean;
          };
          setDisplayName(parsed.displayName ?? meRes.user?.email?.split('@')[0] ?? '');
          setLocale(parsed.locale ?? 'zh-CN');
          setEmailNotice(parsed.emailNotice ?? true);
          setMarketingNotice(parsed.marketingNotice ?? false);
        } else {
          setDisplayName(meRes.user?.email?.split('@')[0] ?? '');
        }
      } catch (e) {
        if (canceled) return;
        const msg = e instanceof Error ? e.message : t.unauthorized;
        setError(msg);
        if (msg.includes('Unauthorized')) router.replace('/login?next=/console');
      }
    }
    void load();
    return () => {
      canceled = true;
    };
  }, [router]);

  async function logout() {
    await apiPost('/auth/logout', undefined, { credentials: 'include' }).catch(() => undefined);
    router.replace('/');
  }

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

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

  function saveSettings() {
    const key = `console-settings:${me?.user?.id ?? 'guest'}`;
    localStorage.setItem(
      key,
      JSON.stringify({
        displayName,
        locale,
        emailNotice,
        marketingNotice,
      }),
    );
    document.cookie = `console_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setSaveMessage(t.saved);
    window.location.assign('/');
  }

  async function submitPasswordChange() {
    if (!oldPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword) {
      setPasswordMessage(locale === 'zh-CN' ? '请完整填写并确认新密码一致' : 'Please complete fields and match passwords');
      return;
    }
    try {
      await apiPost<{ ok: boolean; relogin: boolean }>(
        '/auth/change-password',
        {
          currentPassword: oldPassword,
          newPassword,
        },
        { credentials: 'include' },
      );
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage(t.passwordDone);
      window.alert(locale === 'zh-CN' ? '密码已修改，请重新登录。' : 'Password changed. Please log in again.');
      router.replace('/login?next=/console');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setPasswordMessage(
        locale === 'zh-CN'
          ? msg || '修改密码失败，请检查当前密码是否正确'
          : msg || 'Password change failed. Check current password.',
      );
    }
  }

  function revokeDevice(deviceId: string) {
    setDevices((prev) => prev.filter((item) => item.id !== deviceId || item.current));
    setDeviceMessage(t.revoked);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] px-6 py-10 text-[var(--text-primary)]">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-4">
          <div>
            <div className="subtle-label">User Console</div>
            <h1 className="brand-title text-4xl font-semibold">{me?.isAdmin ? t.adminTitle : t.title}</h1>
            <div className="status-pill mt-2">{me?.isAdmin ? t.roleAdmin : t.roleUser}</div>
          </div>
          <div className="flex items-center gap-2">
            {me?.isAdmin ? (
              <Link href="/admin" className="action-ghost px-3 py-2 text-sm">
                {t.admin}
              </Link>
            ) : null}
            <button type="button" className="action-primary px-3 py-2 text-sm font-medium" onClick={logout}>
              {t.logout}
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" className={`px-3 py-2 text-sm ${activeTab === 'profile' ? 'action-primary' : 'action-ghost'}`} onClick={() => setActiveTab('profile')}>
            {t.profileTab}
          </button>
          <button type="button" className={`px-3 py-2 text-sm ${activeTab === 'orders' ? 'action-primary' : 'action-ghost'}`} onClick={() => setActiveTab('orders')}>
            {t.ordersTab}
          </button>
          <button type="button" className={`px-3 py-2 text-sm ${activeTab === 'settings' ? 'action-primary' : 'action-ghost'}`} onClick={() => setActiveTab('settings')}>
            {t.settingsTab}
          </button>
        </div>
        {error ? <div className="rounded-lg border border-[var(--danger)] bg-[rgba(200,122,122,0.12)] p-3 text-sm text-[var(--danger)]">{error}</div> : null}
        {activeTab === 'profile' ? (
          <div className="glass-shell p-5">
            <div className="subtle-label">{t.profileTitle}</div>
            <div className="mt-2 text-sm text-[var(--text-secondary)]">{t.email}：{me?.user?.email ?? '-'}</div>
            <div className="mt-1 text-sm text-[var(--text-secondary)]">{t.userId}：{me?.user?.id ?? '-'}</div>
            <div className="mt-1 text-sm text-[var(--text-secondary)]">{t.createdAt}：{me?.user?.createdAt ?? '-'}</div>
            {me?.adminDebug ? (
              <div className="mt-4 rounded-lg border border-[var(--border-soft)] p-4">
                <div className="subtle-label">Admin Debug</div>
                <div className="mt-2 grid gap-1 text-xs text-[var(--text-secondary)]">
                  <div>byUserId: {String(me.adminDebug.byUserId)}</div>
                  <div>byEmail: {String(me.adminDebug.byEmail)}</div>
                  <div>adminUserIdsCount: {me.adminDebug.adminUserIdsCount}</div>
                  <div>adminEmailsCount: {me.adminDebug.adminEmailsCount}</div>
                  <div>normalizedEmail: {me.adminDebug.normalizedEmail}</div>
                  <div>userId: {me.adminDebug.userId}</div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {activeTab === 'orders' ? (
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="section-shell p-4">
                <div className="brand-title text-2xl">{order.course.title}</div>
                <div className="mt-2 text-xs text-[var(--text-secondary)]">
                  {t.status}：{getStatusLabel(order.status)} · {t.amount}：{(order.amountCents / 100).toFixed(2)} {order.currency}
                </div>
              </div>
            ))}
            {orders.length === 0 ? <div className="text-sm text-[var(--text-secondary)]">{t.noOrders}</div> : null}
          </div>
        ) : null}
        {activeTab === 'settings' ? (
          <div className="space-y-4">
            <div className="glass-shell p-5">
              <div className="subtle-label">{t.settingsTitle}</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <div className="subtle-label">{t.displayName}</div>
                  <input
                    className="field-input mt-1 w-full px-3 py-2 text-sm"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t.displayNamePlaceholder}
                  />
                </label>
                <label className="block">
                  <div className="subtle-label">{t.language}</div>
                  <select
                    className="field-input mt-1 w-full px-3 py-2 text-sm"
                    value={locale}
                    onChange={(e) => setLocale(e.target.value as 'zh-CN' | 'en-US')}
                  >
                    <option value="zh-CN">简体中文</option>
                    <option value="en-US">English</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="glass-shell p-5">
              <div className="subtle-label">{t.noticeTitle}</div>
              <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                <label className="flex items-center justify-between rounded-lg border border-[var(--border-soft)] px-3 py-2">
                  <span>{t.courseNotice}</span>
                  <input type="checkbox" checked={emailNotice} onChange={(e) => setEmailNotice(e.target.checked)} />
                </label>
                <label className="flex items-center justify-between rounded-lg border border-[var(--border-soft)] px-3 py-2">
                  <span>{t.marketingNotice}</span>
                  <input type="checkbox" checked={marketingNotice} onChange={(e) => setMarketingNotice(e.target.checked)} />
                </label>
              </div>
            </div>
            <div className="glass-shell p-5">
              <div className="subtle-label">{t.securityTitle}</div>
              <div className="mt-3 text-sm text-[var(--text-secondary)]">
                <div>{t.loginEmail}：{me?.user?.email ?? '-'}</div>
                <div className="mt-1">{t.recentDevice}：Windows · Chrome</div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="action-ghost px-3 py-2 text-sm"
                  onClick={() => setShowPasswordPanel((prev) => !prev)}
                >
                  {t.passwordButton}
                </button>
                <button
                  type="button"
                  className="action-ghost px-3 py-2 text-sm"
                  onClick={() => setShowDevicesPanel((prev) => !prev)}
                >
                  {t.devicesButton}
                </button>
              </div>
              {showPasswordPanel ? (
                <div className="mt-4 rounded-lg border border-[var(--border-soft)] p-4">
                  <div className="subtle-label">{t.passwordPanelTitle}</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <input
                      type="password"
                      className="field-input px-3 py-2 text-sm"
                      placeholder={t.oldPassword}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                    />
                    <input
                      type="password"
                      className="field-input px-3 py-2 text-sm"
                      placeholder={t.newPassword}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <input
                      type="password"
                      className="field-input px-3 py-2 text-sm"
                      placeholder={t.confirmPassword}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  <div className="mt-2 text-xs text-[var(--text-muted)]">{t.passwordPlaceholder}</div>
                  <div className="mt-3 flex items-center gap-3">
                    <button type="button" className="action-primary px-3 py-2 text-sm" onClick={submitPasswordChange}>
                      {t.submitPassword}
                    </button>
                    {passwordMessage ? <div className="text-sm text-[var(--accent-green)]">{passwordMessage}</div> : null}
                  </div>
                </div>
              ) : null}
              {showDevicesPanel ? (
                <div className="mt-4 rounded-lg border border-[var(--border-soft)] p-4">
                  <div className="subtle-label">{t.devicePanelTitle}</div>
                  <div className="mt-3 space-y-2">
                    {devices.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg border border-[var(--border-soft)] px-3 py-2 text-sm">
                        <div className="text-[var(--text-secondary)]">
                          {item.name} {item.current ? `(${t.currentDevice})` : ''}
                        </div>
                        {!item.current ? (
                          <button type="button" className="action-ghost px-2 py-1 text-xs" onClick={() => revokeDevice(item.id)}>
                            {t.revoke}
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  {deviceMessage ? <div className="mt-2 text-sm text-[var(--accent-green)]">{deviceMessage}</div> : null}
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={saveSettings} className="action-primary px-4 py-2 text-sm font-medium">
                {t.save}
              </button>
              {saveMessage ? <div className="text-sm text-[var(--accent-green)]">{saveMessage}</div> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

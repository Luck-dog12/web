'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiGet, CourseListItem, formatPrice } from '../lib/api';

type Locale = 'zh-CN' | 'en-US';

type MePayload = {
  user?: { id: string; email: string; createdAt: string } | null;
  isAdmin?: boolean;
};

const textMap = {
  'en-US': {
    admin: 'Admin',
    adminRole: 'Admin',
    userRole: 'User',
    console: 'Console',
    login: 'Login / Register',
    loading: 'Loading...',
    heroTitleA: "Master the world's",
    heroTitleB: 'culinary cultures',
    heroDesc:
      'From Kyoto sushi to Neapolitan pizza, learn authentic techniques with chef-led lessons and lifetime access.',
    s1: '120+ Courses',
    s2: '48 Cuisine Systems',
    s3: '28k Learners',
    loadError: 'Course service is unavailable now. Please refresh later.',
    popular: 'Popular this week',
    loved: 'Most Loved Courses',
    global: 'Global',
    allLevels: 'All Levels',
    featuredSub: 'Course of the month',
  },
  'zh-CN': {
    admin: '管理员',
    adminRole: '管理员',
    userRole: '平台用户',
    console: 'Console',
    login: '登录 / 注册',
    loading: '加载中…',
    heroTitleA: '海外美食文化',
    heroTitleB: '沉浸式学习平台',
    heroDesc:
      '从京都寿司到那不勒斯披萨，系统课程、主厨讲解与终身访问权限，让每一次下厨都更接近地道风味。',
    s1: '120+ 课程',
    s2: '48 种料理体系',
    s3: '28k 学员',
    loadError: '当前课程服务暂时不可用，请稍后刷新重试。',
    popular: '本周热门',
    loved: '最受欢迎的课程',
    global: '全球',
    allLevels: '所有难度',
    featuredSub: '本月精选课程',
  },
} as const;

export function HomePageClient({ locale }: { locale: Locale }) {
  const t = textMap[locale];
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let canceled = false;

    async function load() {
      const [meResult, coursesResult] = await Promise.allSettled([
        apiGet<MePayload>('/auth/me', { credentials: 'include' }),
        apiGet<{ courses: CourseListItem[] }>('/catalog/courses'),
      ]);

      if (canceled) return;

      if (meResult.status === 'fulfilled') {
        setIsLoggedIn(Boolean(meResult.value.user));
        setIsAdmin(Boolean(meResult.value.isAdmin));
      } else {
        setIsLoggedIn(false);
        setIsAdmin(false);
      }
      setAuthReady(true);

      if (coursesResult.status === 'fulfilled') {
        setCourses(coursesResult.value.courses);
        setLoadError(false);
      } else {
        setCourses([]);
        setLoadError(true);
      }
    }

    void load();
    return () => {
      canceled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <main className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <nav className="mb-10 flex items-center justify-between border-b border-[var(--border-soft)] pb-4">
          <div>
            <div className="subtle-label">Global Culinary Academy</div>
            <h1 className="brand-title text-4xl font-semibold">Culinaria</h1>
          </div>
          <div className="flex items-center gap-3">
            {authReady && isLoggedIn ? (
              <span className="status-pill">{isAdmin ? t.adminRole : t.userRole}</span>
            ) : null}
            {!authReady ? (
              <span className="status-pill">{t.loading}</span>
            ) : isAdmin ? (
              <Link className="action-primary px-4 py-2 text-sm font-semibold" href="/admin">
                {t.admin}
              </Link>
            ) : isLoggedIn ? (
              <Link className="action-primary px-4 py-2 text-sm font-semibold" href="/console">
                {t.console}
              </Link>
            ) : (
              <Link className="action-primary px-4 py-2 text-sm font-semibold" href="/login">
                {t.login}
              </Link>
            )}
          </div>
        </nav>

        <section className="glass-shell lift-in grid gap-8 px-8 py-10 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="subtle-label">Master the world&apos;s cuisines</div>
            <h2 className="brand-title mt-3 text-5xl font-semibold leading-[0.95]">
              {t.heroTitleA}
              <br />
              {t.heroTitleB}
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-[var(--text-secondary)]">
              {t.heroDesc}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="status-pill">{t.s1}</span>
              <span className="status-pill">{t.s2}</span>
              <span className="status-pill">{t.s3}</span>
            </div>
          </div>
          <div className="section-shell overflow-hidden">
            <div className="h-full min-h-56 bg-[radial-gradient(ellipse_at_35%_45%,rgba(200,135,58,0.26)_0%,transparent_60%),linear-gradient(145deg,#1f190f_0%,#2f2213_55%,#171108_100%)] p-5">
              <div className="subtle-label">Featured</div>
              <div className="brand-title mt-2 text-2xl leading-tight">Japanese Omakase</div>
              <div className="mt-2 text-xs text-[var(--text-secondary)]">{t.featuredSub}</div>
            </div>
          </div>
        </section>

        {loadError ? (
          <div className="mt-8 rounded-xl border border-[var(--accent-amber-dim)] bg-[var(--accent-amber-glow)] p-4 text-sm text-[var(--text-primary)]">
            {t.loadError}
          </div>
        ) : (
          <section className="mt-10">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <div className="subtle-label">{t.popular}</div>
                <h3 className="brand-title text-3xl">{t.loved}</h3>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {courses.map((course) => (
                <Link
                  key={course.id}
                  href={`/courses/${course.id}`}
                  className="section-shell group overflow-hidden p-5 transition duration-300 hover:-translate-y-1 hover:border-[var(--border-strong)]"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="status-pill">{course.cuisine ?? t.global}</span>
                    <span className="text-xs font-semibold text-[var(--accent-amber)]">
                      {formatPrice(course.priceCentsUsd ?? course.priceCents, 'USD')} /{' '}
                      {formatPrice(course.priceCentsEur ?? course.priceCents, 'EUR')}
                    </span>
                  </div>
                  <div className="brand-title text-2xl leading-tight transition group-hover:text-[var(--accent-amber)]">
                    {course.title}
                  </div>
                  <div className="mt-2 line-clamp-2 text-sm text-[var(--text-secondary)]">
                    {course.description}
                  </div>
                  <div className="mt-4 text-xs text-[var(--text-muted)]">
                    {course.difficulty ?? t.allLevels}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

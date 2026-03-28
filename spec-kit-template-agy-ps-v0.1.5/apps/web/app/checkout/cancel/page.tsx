import Link from 'next/link';
export default async function CheckoutCancelPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const courseIdValue = params.courseId;
  const courseId = Array.isArray(courseIdValue) ? courseIdValue[0] : courseIdValue;
  const retryHref = courseId ? `/courses/${courseId}` : '/';

  return (
    <div className="min-h-screen bg-[var(--bg-base)] px-6 py-10 text-[var(--text-primary)]">
      <div className="glass-shell mx-auto max-w-md p-6">
        <div className="brand-title text-4xl font-semibold">已取消</div>
        <div className="mt-2 text-sm text-[var(--text-secondary)]">你可以随时返回课程页继续购买。</div>
        <div className="mt-6 flex gap-3">
          <Link
            className="action-ghost px-3 py-2 text-sm font-medium"
            href="/"
          >
            返回首页
          </Link>
          <Link className="action-primary px-3 py-2 text-sm font-medium" href={retryHref}>
            重新购买
          </Link>
        </div>
      </div>
    </div>
  );
}


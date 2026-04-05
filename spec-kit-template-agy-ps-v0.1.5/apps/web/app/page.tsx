import { headers } from 'next/headers';
import { HomePageClient } from './home-page-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const reqHeaders = await headers();
  const cookie = reqHeaders.get('cookie') ?? '';
  const locale =
    /(?:^|;\s*)console_locale=(en-US|zh-CN)/.exec(cookie)?.[1] === 'en-US'
      ? 'en-US'
      : 'zh-CN';

  return <HomePageClient locale={locale} />;
}

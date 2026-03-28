import { MvpLoginForm } from './login-form';

export default async function MvpLoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const nextValue = params.next;
  const nextPath = Array.isArray(nextValue) ? nextValue[0] : nextValue ?? '/mvp/videos';
  return <MvpLoginForm nextPath={nextPath} />;
}

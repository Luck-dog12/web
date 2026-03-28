import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const nextValue = params.next;
  const nextPath = Array.isArray(nextValue) ? nextValue[0] : nextValue ?? '/';
  return <LoginForm nextPath={nextPath} />;
}


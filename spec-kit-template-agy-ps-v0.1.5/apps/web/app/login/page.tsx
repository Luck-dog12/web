import { LoginForm } from './login-form';
import { sanitizeNextPath } from '../../lib/navigation/safe-next-path';

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const nextValue = params.next;
  const nextPath = sanitizeNextPath(Array.isArray(nextValue) ? nextValue[0] : nextValue, '/');
  return <LoginForm nextPath={nextPath} />;
}


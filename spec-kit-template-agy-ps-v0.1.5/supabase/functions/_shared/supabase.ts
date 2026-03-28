import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireEnv } from './env.ts';

export function createServiceClient() {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'));
}

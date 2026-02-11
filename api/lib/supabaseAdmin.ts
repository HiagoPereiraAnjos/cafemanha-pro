import { createClient } from '@supabase/supabase-js';

type SupabaseAdminOk = {
  ok: true;
  client: ReturnType<typeof createClient>;
  table: string;
};

type SupabaseAdminError = {
  ok: false;
  error: string;
};

export type SupabaseAdminClientResult = SupabaseAdminOk | SupabaseAdminError;

export const normalizeIdValue = (id: string | number) => {
  if (typeof id === 'number') return id;
  const trimmed = id.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
};

export const createSupabaseAdminClient = (): SupabaseAdminClientResult => {
  const url = process.env.SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const table = process.env.SUPABASE_TABLE || 'cafe_manha';

  if (!url) {
    return {
      ok: false,
      error: 'SUPABASE_URL nao configurada no backend.',
    };
  }

  if (!serviceRoleKey) {
    return {
      ok: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY nao configurada no backend.',
    };
  }

  return {
    ok: true,
    client: createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    table,
  };
};

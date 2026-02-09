import { createClient } from '@supabase/supabase-js';
import { Guest } from '../types';

type ServiceResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

type GuestRow = {
  id: string | number | null;
  name: string;
  room: string;
  company: string;
  check_in: string | null;
  check_out: string | null;
  tariff: string | null;
  plan: string | null;
  has_breakfast: boolean | null;
  used_today: boolean | null;
  consumption_date: string | null;
  created_at: string | null;
  updated_at?: string | null;
  // Compatibility in case old camelCase columns still exist
  checkIn?: string | null;
  checkOut?: string | null;
  hasBreakfast?: boolean | null;
  usedToday?: boolean | null;
  consumptionDate?: string | null;
  createdAt?: string | null;
};

const env = (import.meta as any).env || {};
const win = typeof window !== 'undefined' ? (window as any) : {};

const supabaseUrl =
  env.VITE_SUPABASE_URL ||
  win.SUPABASE_URL ||
  'https://nurjaxbqilrfczpgugfm.supabase.co';

const supabaseAnonKey =
  env.VITE_SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_KEY ||
  win.SUPABASE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51cmpheGJxaWxyZmN6cGd1Z2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MjIyNjEsImV4cCI6MjA3NjE5ODI2MX0.D0wwZePa8MtYGEncFtsqC88u30_Vt-7LuGMFRwIUqA0';

const configuredTableName =
  env.VITE_SUPABASE_TABLE || win.SUPABASE_TABLE || 'cafe_manha';
let resolvedTableName: string | null = null;

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      })
    : null;

const notConfiguredError = 'Supabase nao configurado.';

const ensureClient = () => {
  if (!supabase) {
    return { ok: false as const, error: notConfiguredError };
  }
  return { ok: true as const };
};

const formatError = (error: any) => {
  const message = error?.message || 'Erro desconhecido';
  const isTableNotFound =
    message.includes('Could not find the table') ||
    error?.code === 'PGRST205';

  if (isTableNotFound) {
    return `Tabela '${configuredTableName}' nao encontrada no Supabase. Defina VITE_SUPABASE_TABLE/SUPABASE_TABLE com o nome correto.`;
  }

  return message;
};

const rowToGuest = (row: GuestRow): Guest => ({
  id: String(row.id ?? ''),
  name: row.name || '',
  room: row.room || '',
  company: row.company || '',
  checkIn: row.check_in ?? row.checkIn ?? '',
  checkOut: row.check_out ?? row.checkOut ?? '',
  tariff: row.tariff ?? '',
  plan: row.plan ?? '',
  hasBreakfast: Boolean(row.has_breakfast ?? row.hasBreakfast ?? false),
  usedToday: Boolean(row.used_today ?? row.usedToday ?? false),
  consumptionDate: (row.consumption_date ?? row.consumptionDate ?? null) as
    | string
    | null,
  createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
});

const normalizeIdValue = (id: string | number) => {
  if (typeof id === 'number') return id;
  const trimmed = id.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
};

const normalizeGuestName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const guestToRow = (guest: Guest): GuestRow => ({
  id: normalizeIdValue(guest.id),
  name: guest.name,
  room: guest.room,
  company: guest.company,
  check_in: guest.checkIn,
  check_out: guest.checkOut,
  tariff: guest.tariff,
  plan: guest.plan,
  has_breakfast: guest.hasBreakfast,
  used_today: guest.usedToday,
  consumption_date: guest.consumptionDate,
  created_at: guest.createdAt,
});

const updatesToRow = (updates: Partial<Guest>) => {
  const row: Record<string, unknown> = {};

  if (updates.name !== undefined) row.name = updates.name;
  if (updates.room !== undefined) row.room = updates.room;
  if (updates.company !== undefined) row.company = updates.company;
  if (updates.checkIn !== undefined) row.check_in = updates.checkIn;
  if (updates.checkOut !== undefined) row.check_out = updates.checkOut;
  if (updates.tariff !== undefined) row.tariff = updates.tariff;
  if (updates.plan !== undefined) row.plan = updates.plan;
  if (updates.hasBreakfast !== undefined) row.has_breakfast = updates.hasBreakfast;
  if (updates.usedToday !== undefined) row.used_today = updates.usedToday;
  if (updates.consumptionDate !== undefined) {
    row.consumption_date = updates.consumptionDate;
  }
  if (updates.createdAt !== undefined) row.created_at = updates.createdAt;

  return row;
};

const resolveTableName = async (): Promise<ServiceResult<string>> => {
  const client = ensureClient();
  if (!client.ok) return client;
  if (resolvedTableName) return { ok: true, data: resolvedTableName };

  const candidates = Array.from(
    new Set([configuredTableName, 'cafe_manha', 'guests', 'hospedes', 'hotel_guests'])
  );

  for (const candidate of candidates) {
    const { error } = await supabase.from(candidate).select('id').limit(1);
    if (!error) {
      resolvedTableName = candidate;
      return { ok: true, data: candidate };
    }

    if (error.code !== 'PGRST205') {
      return { ok: false, error: formatError(error) };
    }
  }

  return {
    ok: false,
    error: `Nenhuma tabela encontrada entre: ${candidates.join(', ')}. Configure VITE_SUPABASE_TABLE com o nome correto da tabela.`,
  };
};

export const supabaseService = {
  getGuests: async (): Promise<ServiceResult<Guest[]>> => {
    const client = ensureClient();
    if (!client.ok) return client;
    const tableResult = await resolveTableName();
    if (!tableResult.ok) return tableResult;
    const tableName = tableResult.data!;

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return { ok: false, error: formatError(error) };

    const guests = ((data || []) as GuestRow[]).map(rowToGuest);
    return { ok: true, data: guests };
  },

  getGuestsByRoom: async (room: string): Promise<ServiceResult<Guest[]>> => {
    const client = ensureClient();
    if (!client.ok) return client;
    const tableResult = await resolveTableName();
    if (!tableResult.ok) return tableResult;
    const tableName = tableResult.data!;

    const roomValue = room.trim();
    if (!roomValue) return { ok: true, data: [] };

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('room', roomValue)
      .order('name', { ascending: true });

    if (error) return { ok: false, error: formatError(error) };
    return { ok: true, data: ((data || []) as GuestRow[]).map(rowToGuest) };
  },

  getGuestById: async (id: string): Promise<ServiceResult<Guest | null>> => {
    const client = ensureClient();
    if (!client.ok) return client;
    const tableResult = await resolveTableName();
    if (!tableResult.ok) return tableResult;
    const tableName = tableResult.data!;

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', normalizeIdValue(id))
      .maybeSingle();

    if (error) return { ok: false, error: formatError(error) };
    return { ok: true, data: data ? rowToGuest(data as GuestRow) : null };
  },

  findGuestByRoomAndName: async (
    room: string,
    fullName: string
  ): Promise<ServiceResult<Guest | null>> => {
    const client = ensureClient();
    if (!client.ok) return client;
    const tableResult = await resolveTableName();
    if (!tableResult.ok) return tableResult;
    const tableName = tableResult.data!;

    const roomValue = room.trim();
    const nameValue = normalizeGuestName(fullName);

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('room', roomValue);

    if (error) return { ok: false, error: formatError(error) };

    const found =
      ((data || []) as GuestRow[]).find(
        (g) => normalizeGuestName(g.name || '') === nameValue
      ) || null;

    return { ok: true, data: found ? rowToGuest(found) : null };
  },

  insertGuests: async (
    newGuests: Omit<Guest, 'id' | 'createdAt'>[]
  ): Promise<ServiceResult<Guest[]>> => {
    const client = ensureClient();
    if (!client.ok) return client;
    const tableResult = await resolveTableName();
    if (!tableResult.ok) return tableResult;
    const tableName = tableResult.data!;
    if (newGuests.length === 0) return { ok: true, data: [] };

    // Do not send "id" on insert: table may use integer identity/serial.
    const payload = newGuests.map((g) => ({
      name: g.name,
      room: g.room,
      company: g.company,
      check_in: g.checkIn,
      check_out: g.checkOut,
      tariff: g.tariff,
      plan: g.plan,
      has_breakfast: g.hasBreakfast,
      used_today: g.usedToday,
      consumption_date: g.consumptionDate,
      created_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from(tableName)
      .insert(payload)
      .select('*');

    if (error) return { ok: false, error: formatError(error) };
    return { ok: true, data: ((data || []) as GuestRow[]).map(rowToGuest) };
  },

  saveGuests: async (guests: Guest[]): Promise<ServiceResult<null>> => {
    const client = ensureClient();
    if (!client.ok) return client;
    const tableResult = await resolveTableName();
    if (!tableResult.ok) return tableResult;
    const tableName = tableResult.data!;
    if (guests.length === 0) return { ok: true, data: null };

    const { error } = await supabase
      .from(tableName)
      .upsert(guests.map(guestToRow), { onConflict: 'id' });

    if (error) return { ok: false, error: formatError(error) };
    return { ok: true, data: null };
  },

  updateGuest: async (
    id: string,
    updates: Partial<Guest>
  ): Promise<ServiceResult<Guest | null>> => {
    const client = ensureClient();
    if (!client.ok) return client;
    const tableResult = await resolveTableName();
    if (!tableResult.ok) return tableResult;
    const tableName = tableResult.data!;

    const { data, error } = await supabase
      .from(tableName)
      .update(updatesToRow(updates))
      .eq('id', normalizeIdValue(id))
      .select('*')
      .maybeSingle();

    if (error) return { ok: false, error: formatError(error) };
    return { ok: true, data: data ? rowToGuest(data as GuestRow) : null };
  },

  resetGuests: async (): Promise<ServiceResult<null>> => {
    const client = ensureClient();
    if (!client.ok) return client;
    const tableResult = await resolveTableName();
    if (!tableResult.ok) return tableResult;
    const tableName = tableResult.data!;

    const { error } = await supabase
      .from(tableName)
      .delete()
      .not('id', 'is', null);
    if (error) return { ok: false, error: formatError(error) };
    return { ok: true, data: null };
  },
};

import { Guest } from '../types';

type ServiceResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
};

const parseError = async (response: Response) => {
  try {
    const payload = await response.json();
    return payload?.error || `Erro HTTP ${response.status}`;
  } catch {
    return `Erro HTTP ${response.status}`;
  }
};

const request = async <T>(url: string, options: RequestOptions = {}): Promise<ServiceResult<T>> => {
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      return { ok: false, error: await parseError(response) };
    }

    const payload = await response.json().catch(() => ({}));
    return { ok: true, data: payload?.data as T };
  } catch {
    return { ok: false, error: 'Falha de comunicacao com o backend.' };
  }
};

export const supabaseService = {
  getGuests: async (): Promise<ServiceResult<Guest[]>> => {
    return request<Guest[]>('/api/guests');
  },

  getGuestsByRoom: async (room: string): Promise<ServiceResult<Guest[]>> => {
    const roomValue = room.trim();
    if (!roomValue) return { ok: true, data: [] };
    return request<Guest[]>(`/api/guests?room=${encodeURIComponent(roomValue)}`);
  },

  getGuestById: async (id: string): Promise<ServiceResult<Guest | null>> => {
    return request<Guest | null>(`/api/guests?id=${encodeURIComponent(id)}`);
  },

  findGuestByRoomAndName: async (
    room: string,
    fullName: string
  ): Promise<ServiceResult<Guest | null>> => {
    const roomValue = room.trim();
    const nameValue = fullName.trim();

    if (!roomValue || !nameValue) {
      return { ok: true, data: null };
    }

    return request<Guest | null>(
      `/api/guests?room=${encodeURIComponent(roomValue)}&name=${encodeURIComponent(nameValue)}`
    );
  },

  insertGuests: async (
    newGuests: Omit<Guest, 'id' | 'createdAt'>[]
  ): Promise<ServiceResult<Guest[]>> => {
    return request<Guest[]>('/api/guests', {
      method: 'POST',
      body: { guests: newGuests },
    });
  },

  saveGuests: async (guests: Guest[]): Promise<ServiceResult<null>> => {
    const result = await request<Guest[]>('/api/guests?mode=upsert', {
      method: 'POST',
      body: { guests },
    });

    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, data: null };
  },

  updateGuest: async (
    id: string,
    updates: Partial<Guest>
  ): Promise<ServiceResult<Guest | null>> => {
    return request<Guest | null>(`/api/guests?id=${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: { updates },
    });
  },

  resetGuests: async (): Promise<ServiceResult<null>> => {
    const result = await request<null>('/api/guests', { method: 'DELETE' });
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, data: null };
  },
};

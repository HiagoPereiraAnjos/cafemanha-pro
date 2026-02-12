import { Guest, GuestInsertInput, PublicGuest } from '../types';

type ServiceResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
};

const toFriendlyIssueQrError = (error?: string) => {
  const normalized = String(error || '').toLowerCase();

  if (normalized.includes('geracao de qr disponivel')) {
    return 'O QR Code so pode ser gerado no horario do cafe da manha: de segunda a sabado, das 06:00 as 10:00, e aos domingos, das 07:00 as 10:00 (horario de Sao Paulo).';
  }

  if (normalized.includes('nao disponivel')) {
    return 'QR Code nao disponivel para este hospede no momento.';
  }

  return error || 'Nao foi possivel gerar o QR Code agora. Tente novamente em instantes.';
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
    const data = (payload?.data ?? payload) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Falha de comunicacao com o backend.' };
  }
};

export const supabaseService = {
  getGuests: async (): Promise<ServiceResult<Guest[]>> => {
    return request<Guest[]>('/api/guests');
  },

  getGuestsByRoom: async (room: string): Promise<ServiceResult<PublicGuest[]>> => {
    const roomValue = room.trim();
    if (!roomValue) return { ok: true, data: [] };
    return request<PublicGuest[]>(`/api/guests?room=${encodeURIComponent(roomValue)}`);
  },

  getGuestById: async (id: string): Promise<ServiceResult<Guest | null>> => {
    return request<Guest | null>(`/api/guests?id=${encodeURIComponent(id)}`);
  },

  findGuestByRoomAndName: async (
    room: string,
    fullName: string
  ): Promise<ServiceResult<PublicGuest | null>> => {
    const roomValue = room.trim();
    const nameValue = fullName.trim();

    if (!roomValue || !nameValue) {
      return { ok: true, data: null };
    }

    return request<PublicGuest | null>(
      `/api/guests?room=${encodeURIComponent(roomValue)}&name=${encodeURIComponent(nameValue)}`
    );
  },

  insertGuests: async (
    newGuests: GuestInsertInput[]
  ): Promise<ServiceResult<Guest[]>> => {
    return request<Guest[]>('/api/guests', {
      method: 'POST',
      body: { guests: newGuests },
    });
  },

  replaceGuests: async (
    newGuests: GuestInsertInput[]
  ): Promise<ServiceResult<Guest[]>> => {
    return request<Guest[]>('/api/guests?mode=replace', {
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

  issueQrToken: async (guestId: string): Promise<ServiceResult<{ token: string }>> => {
    const result = await request<{ token: string }>('/api/issue-qr', {
      method: 'POST',
      body: { guestId },
    });

    if (!result.ok) {
      return { ok: false, error: toFriendlyIssueQrError(result.error) };
    }

    return result;
  },

  consumeQrToken: async (
    token: string,
    confirm: boolean = true
  ): Promise<ServiceResult<Guest | null>> => {
    return request<Guest | null>('/api/consume', {
      method: 'POST',
      body: { token, confirm },
    });
  },
};


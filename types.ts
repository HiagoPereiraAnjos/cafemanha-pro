
export interface Guest {
  id: string;
  name: string;
  room: string;
  company: string;
  checkIn: string;
  checkOut: string;
  tariff: string;
  plan: string;
  hasBreakfast: boolean;
  // Campo derivado no backend: true quando consumptionDate === hoje (America/Sao_Paulo).
  usedToday: boolean;
  consumptionDate: string | null;
  createdAt: string;
}

export type GuestInsertInput = Omit<Guest, 'id' | 'createdAt' | 'usedToday'>;

export interface PublicGuest {
  id: string;
  name: string;
  hasBreakfast: boolean;
  usedToday: boolean;
}

export interface AppStats {
  totalGuests: number;
  totalRooms: number;
  withBreakfast: number;
  usedTodayCount: number;
}

export enum UserRole {
  RECEPTION = 'RECEPCAO',
  RESTAURANT = 'RESTAURANTE',
  GUEST = 'HOSPEDE',
  VALIDATOR = 'VALIDAR'
}

export interface AuthSession {
  role: UserRole;
  timestamp: number;
  authenticated: boolean;
}

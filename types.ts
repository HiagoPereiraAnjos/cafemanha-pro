
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
  usedToday: boolean;
  consumptionDate: string | null;
  createdAt: string;
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


import { Guest } from '../types';

const STORAGE_KEY = 'hotel_breakfast_guests';

export const storageService = {
  getGuests: (): Guest[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveGuests: (guests: Guest[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(guests));
  },

  updateGuest: (id: string, updates: Partial<Guest>) => {
    const guests = storageService.getGuests();
    const updated = guests.map(g => g.id === id ? { ...g, ...updates } : g);
    storageService.saveGuests(updated);
    return updated;
  },

  addGuest: (guest: Omit<Guest, 'id' | 'createdAt'>) => {
    const guests = storageService.getGuests();
    const newGuest: Guest = {
      ...guest,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    const updated = [...guests, newGuest];
    storageService.saveGuests(updated);
    return updated;
  },

  resetDatabase: () => {
    localStorage.removeItem(STORAGE_KEY);
  },

  bulkInsert: (newGuests: Omit<Guest, 'id' | 'createdAt'>[]) => {
    const currentGuests = storageService.getGuests();
    const formatted = newGuests.map(g => ({
      ...g,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    }));
    const updated = [...currentGuests, ...formatted];
    storageService.saveGuests(updated);
    return updated;
  }
};

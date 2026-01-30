
import { Resident, IncidentReport, PatrolLog, GuestLog, ChatMessage } from '../types.ts';

/**
 * TKA VERCEL-POSTGRES BRIDGE (v10.0)
 * Melakukan komunikasi langsung dengan Vercel Serverless Functions.
 */

const fetchCloud = async (endpoint: string, options: RequestInit = {}) => {
  try {
    const response = await fetch(`/api/${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Cloud Error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.warn(`Vercel API [${endpoint}] tidak merespon. Pastikan Route /api tersedia.`);
    throw error;
  }
};

export const db = {
  resident: {
    findMany: async () => fetchCloud('residents'),
    create: async (payload: Partial<Resident>) => fetchCloud('residents', { method: 'POST', body: JSON.stringify(payload) }),
    update: async (id: string, payload: Partial<Resident>) => fetchCloud(`residents?id=${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    delete: async (id: string) => fetchCloud(`residents?id=${id}`, { method: 'DELETE' }),
    subscribe: (callback: (payload: any) => void) => {
      // Polling as fallback for Vercel Serverless (Realtime replacement)
      const interval = setInterval(async () => {
        try {
          const data = await fetchCloud('residents');
          callback({ eventType: 'UPDATE_ALL', data });
        } catch (e) {}
      }, 10000);
      return { unsubscribe: () => clearInterval(interval) };
    }
  },
  incident: {
    findMany: async () => fetchCloud('incidents'),
    create: async (payload: Partial<IncidentReport>) => fetchCloud('incidents', { method: 'POST', body: JSON.stringify(payload) }),
    update: async (id: string, payload: Partial<IncidentReport>) => fetchCloud(`incidents?id=${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
  },
  patrol: {
    findMany: async () => fetchCloud('patrol'),
    create: async (payload: Partial<PatrolLog>) => fetchCloud('patrol', { method: 'POST', body: JSON.stringify(payload) })
  },
  guest: {
    findMany: async () => fetchCloud('guests'),
    create: async (payload: Partial<GuestLog>) => fetchCloud('guests', { method: 'POST', body: JSON.stringify(payload) }),
    update: async (id: string, payload: Partial<GuestLog>) => fetchCloud(`guests?id=${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
  },
  chat: {
    findMany: async () => fetchCloud('chat'),
    create: async (payload: Partial<ChatMessage>) => fetchCloud('chat', { method: 'POST', body: JSON.stringify(payload) }),
    subscribe: (callback: (payload: any) => void) => {
      const interval = setInterval(async () => {
        try {
          const data = await fetchCloud('chat');
          if (data) callback({ eventType: 'INSERT', new: data[data.length - 1] });
        } catch (e) {}
      }, 5000);
      return { unsubscribe: () => clearInterval(interval) };
    }
  }
};
